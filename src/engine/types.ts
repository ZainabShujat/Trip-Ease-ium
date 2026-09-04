import type {
  BudgetSummary,
  ItineraryDay,
  LodgingOption,
  PipelineStage,
  Poi,
  Provenance,
  SourceKind,
  TransportOption,
  TravelMatrix,
  TripBrief,
  ValidationReport,
} from '@/lib/schemas';

/**
 * Engine stage contracts.
 *
 * Every stage is a pure function: data in, data out. No stage may read the
 * database, call a provider or touch React. Providers are called once, up
 * front by `src/planning/`, and their results are passed in as
 * `SourcedCandidates`. An ESLint rule on `src/engine/**` enforces this.
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
  /** Provenance of each input feed, carried through to the finished plan so
   *  the UI can badge a trip built on estimates. */
  provenance: {
    transport: Provenance;
    lodging: Provenance;
    places: Provenance;
    routing: Provenance;
  };
}

/** A POI with its computed score, kept together so ranking is inspectable. */
export interface ScoredPoi {
  poi: Poi;
  score: number;
  /** Component breakdown, retained for the evaluation harness and for
   *  explaining a recommendation without asking a model to invent a reason. */
  components: {
    preferenceMatch: number;
    quality: number;
    proximity: number;
    accessibility: number;
  };
  /** Set when an accessibility need rules this POI out entirely. */
  excludedBy?: string;
}

/** What the scoring stage decided, before anything is scheduled. */
export interface Selections {
  outbound: TransportOption;
  inbound: TransportOption;
  local: TransportOption[];
  lodging: LodgingOption;
  /** POIs that made the shortlist, best first. */
  shortlist: Poi[];
  /** Scores behind the shortlist, same order. */
  scored: ScoredPoi[];
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

/** How clustering arrived at its answer. Reported, not hidden, because the
 *  fallbacks matter more than the happy path when data is thin. */
export type ClusterStrategy =
  'KMEANS' | 'SINGLE_CLUSTER' | 'ONE_PER_DAY' | 'SCORE_ORDERED' | 'EMPTY';

export interface ClusterResult {
  clusters: DayCluster[];
  strategy: ClusterStrategy;
  /** Set when the number of usable days exceeded the POIs available. */
  notes: string[];
}

/** Per-day usable window, derived from transport times and the waking window. */
export interface DayFrame {
  dayIndex: number;
  date: string;
  /** Local minutes from midnight. Null when the traveller is not at the
   *  destination that day (in transit, or still at the origin). */
  windowStartMins: number | null;
  windowEndMins: number | null;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  /** True when there is enough usable time to schedule activities. */
  isActivityDay: boolean;
}

export interface ScheduleOutcome {
  days: ItineraryDay[];
  relaxedConstraints: string[];
  /** POIs the scheduler could not place, with the reason. Surfaced rather
   *  than silently dropped. */
  unplaced: Array<{ poiId: string; reason: string }>;
}

/** Per-stage wall-clock timing, for the latency metric. */
export type StageTimings = Partial<Record<PipelineStage, number>>;

/** A complete plan, as the engine hands it to persistence and the UI. */
export interface PlannedTrip {
  brief: TripBrief;
  selections: Selections;
  clusters: DayCluster[];
  days: ItineraryDay[];
  budget: BudgetSummary;
  validation: ValidationReport;
  relaxedConstraints: string[];
  unplaced: Array<{ poiId: string; reason: string }>;
  timings: StageTimings;
  /** Weakest provenance across every input. A plan built on any mock data is
   *  a mock plan, and the UI must say so. */
  overallSourceKind: SourceKind;
  clusterStrategy: ClusterStrategy;
}

// ---------------------------------------------------------------------------
// Stage signatures
// ---------------------------------------------------------------------------

export type ScoreStage = (brief: TripBrief, candidates: SourcedCandidates) => Selections;

export type ClusterStage = (
  brief: TripBrief,
  selections: Selections,
  frames: DayFrame[],
) => ClusterResult;

export type ScheduleStage = (
  brief: TripBrief,
  selections: Selections,
  clusters: DayCluster[],
  matrix: TravelMatrix,
) => ScheduleOutcome;

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
  matrix: TravelMatrix,
) => ValidationReport;

/** Progress event streamed to the client while a plan is being built. */
export interface StageProgress {
  stage: PipelineStage;
  status: 'started' | 'completed' | 'failed';
  /** Human sentence for the planning screen, e.g. "Scoring 6 hotels". */
  message: string;
  elapsedMs?: number;
}
