import type { Interest, PoiCategory, TripPace } from '@/lib/schemas';

/**
 * Every tunable number in the planning engine, in one file.
 *
 * Architecture rule §15.2: business logic must not be scattered as magic
 * numbers. A weight buried three modules deep cannot be reviewed, cannot be
 * swept in an experiment, and cannot be reported on. Everything the engine
 * decides with lives here, is exported as a typed constant, and is referenced
 * by name at the point of use.
 *
 * These values are also the knobs the evaluation harness will vary when we
 * measure preference satisfaction and budget adherence.
 */

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

/**
 * Multi-objective weights. Each component contributes a normalised 0..1 score
 * and the weighted sum is the candidate's rank. Weights sum to 1.0 within each
 * group so a total score is directly comparable across categories.
 */
export const SCORING_WEIGHTS = {
  poi: {
    /** Overlap between the POI's tags and the traveller's stated interests. */
    preferenceMatch: 0.4,
    /** Rating, damped by review count so a lone 5-star does not outrank a
     *  well-reviewed 4.5. */
    quality: 0.25,
    /** Closeness to the destination centre, as a proxy for reachability
     *  before clustering has run. */
    proximity: 0.2,
    /** Penalty-free only when the POI suits the party's stated needs. */
    accessibility: 0.15,
  },
  lodging: {
    priceFit: 0.35,
    quality: 0.25,
    /** Distance to the centroid of shortlisted POIs — the number behind
     *  "close to most of your activities". */
    proximity: 0.25,
    tierMatch: 0.15,
  },
  transport: {
    priceFit: 0.4,
    /** Shorter journeys score higher. */
    speed: 0.3,
    comfort: 0.2,
    /** Penalises overnight services when the traveller asked to avoid them. */
    preferenceMatch: 0.1,
  },
} as const;

/** Reviews needed before a rating is taken at close to face value. */
export const RATING_CONFIDENCE_REVIEWS = 500;

/**
 * Share of the total budget each category may consume when allocating
 * envelopes up front. These are starting allocations, not caps — the ledger
 * reports actual estimates against them.
 */
export const BUDGET_ALLOCATION = {
  TRANSPORT: 0.28,
  ACCOMMODATION: 0.35,
  FOOD: 0.18,
  ACTIVITIES: 0.12,
  LOCAL_TRANSPORT: 0.05,
  MISC: 0.02,
} as const;

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

export interface PaceProfile {
  /** Maximum scheduled sights/activities per day, excluding meals and transit. */
  maxActivitiesPerDay: number;
  /** Maximum minutes of a day spent inside scheduled items. */
  maxScheduledMins: number;
  /** Slack left between items so a plan does not read as back-to-back. */
  bufferMins: number;
}

export const PACE_PROFILES: Record<TripPace, PaceProfile> = {
  RELAXED: { maxActivitiesPerDay: 3, maxScheduledMins: 6 * 60, bufferMins: 20 },
  BALANCED: { maxActivitiesPerDay: 4, maxScheduledMins: 8 * 60, bufferMins: 15 },
  PACKED: { maxActivitiesPerDay: 6, maxScheduledMins: 10 * 60, bufferMins: 10 },
};

// ---------------------------------------------------------------------------
// Scheduling windows and buffers
// ---------------------------------------------------------------------------

export const SCHEDULING = {
  /** Getting from the bus stand to the hotel, finding the room, dropping bags. */
  arrivalTransferMins: 45,
  /** Being at the departure point before the return service leaves. */
  departureBufferMins: 60,
  /** A day with less usable time than this is not an activity day. */
  minUsableDayMins: 150,
  /** Longest a traveller is asked to sit in a vehicle without a break. */
  maxContinuousTravelMins: 210,
  /** Waiting outside a closed attraction beyond this is pointless; skip it. */
  maxWaitForOpeningMins: 45,
  /** Time set aside for hotel check-in as a scheduled item. */
  checkInDurationMins: 30,
  checkOutDurationMins: 30,
} as const;

/** Windows in which a meal should fall, in local minutes from midnight. */
export const MEAL_WINDOWS = [
  { name: 'BREAKFAST', startMins: 7 * 60, endMins: 10 * 60 + 30, durationMins: 45 },
  { name: 'LUNCH', startMins: 12 * 60, endMins: 15 * 60, durationMins: 60 },
  { name: 'DINNER', startMins: 19 * 60, endMins: 22 * 60, durationMins: 75 },
] as const;

export type MealName = (typeof MEAL_WINDOWS)[number]['name'];

// ---------------------------------------------------------------------------
// Relaxation
// ---------------------------------------------------------------------------

/**
 * The order in which SOFT constraints are given up when no feasible schedule
 * exists. Earlier entries are surrendered first, so the things travellers
 * notice least go first and the trip's character survives longest.
 *
 * HARD constraints — opening hours, travel-time feasibility, the waking
 * window, check-in/check-out — are never in this list. If the plan is still
 * infeasible once every relaxation here is exhausted, the engine returns
 * INFEASIBLE_CONSTRAINTS rather than emitting a plan it knows is wrong.
 */
export const RELAXATION_ORDER = [
  /** Stop insisting every stated interest appears in the plan. */
  'INTEREST_COVERAGE',
  /** Allow a day to exceed the pace profile's activity count. */
  'PACE_ACTIVITY_LIMIT',
  /** Allow a day to exceed the traveller's daily travel tolerance. */
  'DAILY_TRAVEL_LIMIT',
  /** Allow meals outside their preferred windows. */
  'MEAL_WINDOWS',
  /** Allow a day to exceed the pace profile's total scheduled minutes. */
  'PACE_SCHEDULED_MINS',
  /** Drop the lowest-scoring shortlisted POIs entirely. */
  'DROP_LOW_SCORING_POIS',
] as const;

export type RelaxableConstraint = (typeof RELAXATION_ORDER)[number];

// ---------------------------------------------------------------------------
// Interest matching
// ---------------------------------------------------------------------------

/**
 * Maps a stated interest to the POI tags and categories that serve it.
 * Explicit rather than inferred, so "we want more nature" has a defined,
 * testable meaning instead of depending on a string-similarity heuristic.
 */
export const INTEREST_TAGS: Record<Interest, readonly string[]> = {
  NATURE: ['nature', 'waterfall', 'valley', 'deodar', 'river', 'snow', 'viewpoint'],
  ADVENTURE: ['adventure', 'paragliding', 'rafting', 'ropeway', 'ski', 'zip'],
  CULTURE: ['culture', 'art', 'museum', 'architecture', 'village'],
  HERITAGE: ['heritage', 'temple', 'castle', 'fort', 'architecture', 'historic'],
  FOOD: ['food', 'north indian', 'himachali', 'goan', 'rajasthani', 'thali', 'dinner', 'lunch'],
  CAFES: ['cafes', 'coffee', 'breakfast', 'bakery', 'terrace'],
  NIGHTLIFE: ['nightlife', 'bar', 'live music', 'evening'],
  SHOPPING: ['shopping', 'market', 'bazaar', 'handicraft'],
  RELAXATION: ['quiet', 'spa', 'hot springs', 'beach', 'easy', 'riverside'],
  PHOTOGRAPHY: ['photography', 'viewpoint', 'sunset', 'scenic'],
  SPIRITUAL: ['spiritual', 'temple', 'monastery', 'buddhist', 'ghat'],
  TREKKING: ['trekking', 'trail', 'hike', 'strenuous', 'steep'],
};

export const INTEREST_CATEGORIES: Record<Interest, readonly PoiCategory[]> = {
  NATURE: ['NATURE', 'VIEWPOINT'],
  ADVENTURE: ['ACTIVITY'],
  CULTURE: ['MUSEUM', 'TEMPLE'],
  HERITAGE: ['MUSEUM', 'TEMPLE', 'SIGHT'],
  FOOD: ['RESTAURANT'],
  CAFES: ['CAFE'],
  NIGHTLIFE: ['CAFE', 'MARKET'],
  SHOPPING: ['SHOPPING', 'MARKET'],
  RELAXATION: ['NATURE', 'CAFE'],
  PHOTOGRAPHY: ['VIEWPOINT', 'NATURE', 'SIGHT'],
  SPIRITUAL: ['TEMPLE'],
  TREKKING: ['NATURE'],
};

/** Tags that make a POI unsuitable for a given accessibility need. */
export const ACCESSIBILITY_EXCLUSIONS = {
  LIMITED_WALKING: ['trekking', 'strenuous', 'steep', 'uphill walk', 'trail', 'hike'],
  WHEELCHAIR: ['trekking', 'strenuous', 'steep', 'uphill walk', 'trail', 'hike', 'stairs'],
  NO_STEEP_TERRAIN: ['steep', 'strenuous', 'uphill walk', 'high altitude'],
  MOTION_SICKNESS: ['long drive', 'winding road'],
} as const;

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

export const CLUSTERING = {
  /** k-means restarts. Deterministic seeding, so this only guards against a
   *  poor split, never against randomness. */
  maxIterations: 50,
  /** Stop when no centroid moves further than this, in degrees. */
  convergenceEpsilon: 1e-7,
  /** Below this many POIs per day, clustering is skipped — see cluster/index.ts. */
  minPoisForClustering: 2,
} as const;

// ---------------------------------------------------------------------------
// Route optimisation
// ---------------------------------------------------------------------------

export const ROUTING = {
  /** Cap on 2-opt passes. The tour lengths here are single-digit, so this is
   *  a guard against a pathological case rather than a real limit. */
  maxTwoOptPasses: 60,
  /** Improvement below this many minutes is not worth reordering a day for. */
  minImprovementMins: 1,
} as const;

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export const BUDGET = {
  /** Meals per day assumed when estimating food cost. */
  mealsPerDay: 3,
  /** Fallback per-person per-meal spend when no eatery is scheduled. */
  fallbackMealCostPerPersonMinor: 35_000, // ₹350
  /** Under this fraction of budget used, flag an unused allowance. */
  underUtilisedRatio: 0.75,
  /** At or above this fraction, warn the budget is nearly exhausted. */
  nearlyExhaustedRatio: 0.95,
  /** reduceToBudget gives up after this many substitution rounds. */
  maxSubstitutionRounds: 40,
} as const;
