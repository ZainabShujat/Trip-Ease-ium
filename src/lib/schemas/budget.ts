import { z } from 'zod';
import { CurrencySchema, MinorAmountSchema } from './common';

export const BudgetCategorySchema = z.enum([
  'TRANSPORT',
  'ACCOMMODATION',
  'FOOD',
  'ACTIVITIES',
  'LOCAL_TRANSPORT',
  'MISC',
]);
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

export const BUDGET_CATEGORIES = BudgetCategorySchema.options;

/**
 * One row of the ledger.
 *
 *   allocated — what the planner set aside for this category up front
 *   estimated — what the current plan actually comes to
 *   actual    — what the user recorded having spent (Phase 4 onwards)
 *
 * Keeping all three separate is what lets the dashboard say "accommodation is
 * 12% over its envelope" rather than only "you are over budget".
 */
export const BudgetLineSchema = z.object({
  category: BudgetCategorySchema,
  allocatedMinor: MinorAmountSchema.default(0),
  estimatedMinor: MinorAmountSchema.default(0),
  actualMinor: MinorAmountSchema.default(0),
});
export type BudgetLine = z.infer<typeof BudgetLineSchema>;

export const BudgetStatusSchema = z.enum(['UNDER', 'ON_TRACK', 'NEARLY_EXHAUSTED', 'EXCEEDED']);
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

export const BudgetSummarySchema = z.object({
  currency: CurrencySchema.default('INR'),
  totalBudgetMinor: MinorAmountSchema,
  totalEstimatedMinor: MinorAmountSchema,
  /** Signed: negative means over budget. Not a MinorAmount, which is
   *  non-negative by definition. */
  remainingMinor: z.number().int(),
  lines: z.array(BudgetLineSchema),
  status: BudgetStatusSchema,
});
export type BudgetSummary = z.infer<typeof BudgetSummarySchema>;

/**
 * Thresholds the dashboard reads. Defined here as data rather than as
 * magic numbers inside a component, per architecture rule §15.2.
 */
export const BUDGET_THRESHOLDS = {
  /** Below this fraction of the budget, flag a large unused allowance. */
  underUtilised: 0.75,
  /** At or above this fraction, warn that the budget is nearly exhausted. */
  nearlyExhausted: 0.95,
} as const;
