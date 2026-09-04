import type {
  BudgetSummary,
  ItineraryDay,
  LodgingOption,
  PipelineStage,
  Poi,
  TransportOption,
  TravelMatrix,
  TripBrief,
  ValidationReport,
} from '@/lib/schemas';

/**
 * Engine stage contracts.
 *
 * This file declares the SHAPE of the planning pipeline. The implementations
 * land in Phase 2 (scheduling, budget, validation) and Phase 3 (scoring,
 * clustering, routing). Nothing here is a stub that pretends to work — these
 * are types, so a half-built pipeline fails to compile rather than silently
 * returning an empty itinerary.
 *
 * Every stage is a pure function: data in, data out. No stage may read the
 * database, call a provider or touch React. Providers are called once, up
 * front, and their results are passed in as `SourcedCandidates`. This is
 * enforced by an ESLint rule on `src/engine/**` in eslint.config.mjs.
 */

/** Everything the providers returned, before any decision has been made. */
export interface SourcedCandidates {
  outboundTransport: TransportOption[];
  returnTransport: TransportOption[];
  localTransport: TransportOption[];
  lodging: LodgingOption[];
  pois: Poi[];
  /** Pairwise travel times between every candidate POI and the lodging. */
  matrix: TravelMatrix;
}

/** What the scoring stage decided, before anything is scheduled. */
export interface Selections {
  outbound: TransportOption;
  inbound: TransportOption;
  local: TransportOption[];
  lodging: LodgingOption;
  /** POIs that made the shortlist, best first. */
  shortlist: Poi[];
  /** Alternatives offered to the user for each important decision. */
  alternatives: {
    transport: TransportOption[];
    lodging: LodgingOption[];
  };
}

/** Day clusters produced by the geographic clustering stage. */
export interface DayCluster {
  dayIndex: number;
  poiIds: string[];
  centroid: { lat: number; lng: number };
}

/** A complete plan, as the engine hands it to persistence and the UI. */
export interface PlannedTrip {
  brief: TripBrief;
  selections: Selections;
  days: ItineraryDay[];
  budget: BudgetSummary;
  validation: ValidationReport;
}

// ---------------------------------------------------------------------------
// Stage signatures
// ---------------------------------------------------------------------------

export type ScoreStage = (brief: TripBrief, candidates: SourcedCandidates) => Selections;

export type ClusterStage = (
  brief: TripBrief,
  selections: Selections,
  matrix: TravelMatrix,
) => DayCluster[];

export type ScheduleStage = (
  brief: TripBrief,
  selections: Selections,
  clusters: DayCluster[],
  matrix: TravelMatrix,
) => { days: ItineraryDay[]; relaxedConstraints: string[] };

export type BudgetStage = (
  brief: TripBrief,
  selections: Selections,
  days: ItineraryDay[],
) => BudgetSummary;

export type ValidateStage = (
  brief: TripBrief,
  selections: Selections,
  days: ItineraryDay[],
  budget: BudgetSummary,
) => ValidationReport;

/** Progress event streamed to the client while a plan is being built. */
export interface StageProgress {
  stage: PipelineStage;
  status: 'started' | 'completed' | 'failed';
  /** Human sentence for the planning screen, e.g. "Scoring 6 hotels". */
  message: string;
  elapsedMs?: number;
}
