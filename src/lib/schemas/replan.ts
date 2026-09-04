import { z } from 'zod';
import {
  InterestSchema,
  IsoDateSchema,
  LodgingTierSchema,
  MinorAmountSchema,
  TimeOfDaySchema,
  TransportModeSchema,
  TripPaceSchema,
} from './common';

/**
 * ReplanIntent — the closed set of changes a user can make to a plan.
 *
 * This type is what turns replanning from a second act of generation into a
 * deterministic recomputation. The LLM's only role is to classify free text
 * ("get this under 35,000") into one of these variants. Once classified, the
 * engine re-runs from the earliest affected stage; the model never edits the
 * plan itself.
 *
 * Text that matches nothing here becomes CLARIFY — the assistant asks a
 * question rather than guessing at someone's holiday.
 */

export const PIPELINE_STAGES = [
  'INTAKE',
  'SOURCE',
  'SCORE',
  'CLUSTER',
  'ROUTE',
  'SCHEDULE',
  'BUDGET',
  'VALIDATE',
  'NARRATE',
] as const;
export const PipelineStageSchema = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const ReplanIntentSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('SET_BUDGET'),
    budgetTotalMinor: MinorAmountSchema,
  }),
  z.object({
    op: z.literal('ADD_CONSTRAINT'),
    constraint: z.enum([
      'NO_OVERNIGHT_TRANSPORT',
      'NO_LONG_WALKS',
      'NO_STEEP_TERRAIN',
      'VEGETARIAN_ONLY',
      'AVOID_CROWDS',
    ]),
  }),
  z.object({
    op: z.literal('REMOVE_CONSTRAINT'),
    constraint: z.string().min(1),
  }),
  z.object({
    op: z.literal('CHANGE_DURATION'),
    startDate: IsoDateSchema.optional(),
    endDate: IsoDateSchema,
  }),
  z.object({
    op: z.literal('SHIFT_INTERESTS'),
    more: z.array(InterestSchema).default([]),
    less: z.array(InterestSchema).default([]),
  }),
  z.object({
    op: z.literal('REPLACE_SELECTION'),
    target: z.enum(['LODGING', 'TRANSPORT_OUTBOUND', 'TRANSPORT_RETURN', 'ITEM']),
    /** Id of the thing being replaced; omitted means "the current selection". */
    subjectId: z.string().optional(),
    reason: z.string().optional(),
  }),
  z.object({
    op: z.literal('SET_PACE'),
    pace: TripPaceSchema,
  }),
  z.object({
    op: z.literal('SET_DAILY_WINDOW'),
    wakeTime: TimeOfDaySchema.optional(),
    sleepTime: TimeOfDaySchema.optional(),
  }),
  z.object({
    op: z.literal('SET_TRANSPORT_MODES'),
    modes: z.array(TransportModeSchema).min(1),
  }),
  z.object({
    op: z.literal('SET_LODGING_TIER'),
    tier: LodgingTierSchema,
  }),
  z.object({
    op: z.literal('SET_ACCESSIBILITY'),
    needs: z
      .array(z.enum(['LIMITED_WALKING', 'WHEELCHAIR', 'NO_STEEP_TERRAIN', 'MOTION_SICKNESS']))
      .min(1),
  }),
  z.object({
    op: z.literal('LOCK_ITEM'),
    itemId: z.string().min(1),
    locked: z.boolean().default(true),
  }),
  z.object({
    op: z.literal('CLARIFY'),
    /** Asked back to the user when the request cannot be typed confidently. */
    question: z.string().min(1),
  }),
]);
export type ReplanIntent = z.infer<typeof ReplanIntentSchema>;
export type ReplanOp = ReplanIntent['op'];

/**
 * Which pipeline stage each intent must restart from.
 *
 * This map IS the dependency graph from the approved architecture. Changing
 * the budget cannot be handled by nudging prices in place — it re-scores
 * candidates and flows through clustering, routing, scheduling and the
 * ledger. Encoding that here keeps the rule in one reviewable place instead
 * of scattered through the replan implementation.
 */
export const REPLAN_RESTART_STAGE: Record<ReplanOp, PipelineStage> = {
  SET_BUDGET: 'SCORE',
  ADD_CONSTRAINT: 'SCORE',
  REMOVE_CONSTRAINT: 'SCORE',
  CHANGE_DURATION: 'SOURCE',
  SHIFT_INTERESTS: 'SCORE',
  REPLACE_SELECTION: 'ROUTE',
  SET_PACE: 'SCHEDULE',
  SET_DAILY_WINDOW: 'SCHEDULE',
  SET_TRANSPORT_MODES: 'SOURCE',
  SET_LODGING_TIER: 'SCORE',
  SET_ACCESSIBILITY: 'SCORE',
  LOCK_ITEM: 'VALIDATE',
  CLARIFY: 'VALIDATE',
};

/** Stages that must re-run for an intent, in pipeline order. */
export function stagesToRerun(op: ReplanOp): PipelineStage[] {
  const from = REPLAN_RESTART_STAGE[op];
  const start = PIPELINE_STAGES.indexOf(from);
  return PIPELINE_STAGES.slice(start);
}

/**
 * A previewed change, shown to the user before anything is committed.
 * Replans are never applied silently — the user sees what moved and confirms.
 */
export const ReplanPreviewSchema = z.object({
  intent: ReplanIntentSchema,
  stagesRerun: z.array(PipelineStageSchema),
  summary: z.string().min(1),
  changes: z.array(
    z.object({
      kind: z.enum(['ADDED', 'REMOVED', 'MOVED', 'REPLACED', 'REPRICED']),
      description: z.string().min(1),
      dayIndex: z.number().int().nonnegative().optional(),
      costDeltaMinor: z.number().int().default(0),
    }),
  ),
  totalCostDeltaMinor: z.number().int(),
});
export type ReplanPreview = z.infer<typeof ReplanPreviewSchema>;
