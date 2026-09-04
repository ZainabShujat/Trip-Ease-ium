import type {
  GeoPoint,
  IntercityQuery,
  IsoDate,
  LocalTransportQuery,
  LodgingOption,
  LodgingQuery,
  PlaceQuery,
  Poi,
  SourceKind,
  Sourced,
  TransportMode,
  TransportOption,
  TravelLeg,
  TravelMatrix,
} from '@/lib/schemas';

/**
 * Provider interfaces.
 *
 * The engine and the UI depend only on these. Swapping the Phase 1 mock
 * implementations for Google Places, a real routing API or an affiliate feed
 * in Phase 5 is a change to src/providers/ and nothing else.
 *
 * Two properties every implementation must honour:
 *
 *   1. Return `Sourced<T>`, never a bare payload. Provenance is not optional
 *      metadata — it decides how the UI labels the result.
 *   2. Throw `ProviderUnavailableError` on failure rather than returning
 *      empty. "No hotels found" and "the hotel provider is down" are
 *      different facts and the user is told which.
 */

export interface Provider {
  /** Stable identifier used in logs, the cache key and the UI badge. */
  readonly name: string;
  /** What this implementation produces. Mock providers declare 'mock'. */
  readonly defaultSourceKind: SourceKind;
  /** False when required configuration (an API key) is missing. */
  isConfigured(): boolean;
}

export interface TransportProvider extends Provider {
  /** Services between two cities on a date. */
  searchIntercity(query: IntercityQuery): Promise<Sourced<TransportOption[]>>;
  /** Ways of getting around within a destination. Modes, not departures. */
  searchLocal(query: LocalTransportQuery): Promise<Sourced<TransportOption[]>>;
}

export interface LodgingProvider extends Provider {
  search(query: LodgingQuery): Promise<Sourced<LodgingOption[]>>;
}

export interface PlacesProvider extends Provider {
  search(query: PlaceQuery): Promise<Sourced<Poi[]>>;
  /** Null when the reference is unknown, rather than a fabricated placeholder. */
  details(providerRef: string): Promise<Sourced<Poi | null>>;
}

export interface RoutingProvider extends Provider {
  /** Pairwise travel times for every point. One call serves a whole trip. */
  matrix(points: readonly GeoPoint[], mode: TransportMode): Promise<Sourced<TravelMatrix>>;
  leg(from: GeoPoint, to: GeoPoint, mode: TransportMode): Promise<Sourced<TravelLeg>>;
}

export interface DailyWeather {
  date: IsoDate;
  minTempC: number;
  maxTempC: number;
  /** Short description: 'clear', 'rain', 'snow', 'cloudy'. */
  condition: string;
  precipitationChance: number;
}

export interface WeatherProvider extends Provider {
  daily(at: GeoPoint, start: IsoDate, end: IsoDate): Promise<Sourced<DailyWeather[]>>;
}

/** The complete set the engine is handed. */
export interface ProviderSet {
  transport: TransportProvider;
  lodging: LodgingProvider;
  places: PlacesProvider;
  routing: RoutingProvider;
  weather: WeatherProvider;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** The provider could not answer. Distinct from "answered with nothing". */
export class ProviderUnavailableError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Thrown when live providers are requested but not yet built.
 *
 * This exists so that selecting PROVIDER_MODE=live in Phase 1 fails loudly
 * instead of silently serving mock data that the UI would then present as
 * real. Rule §15.11: never fabricate live availability.
 */
export class ProviderNotImplementedError extends Error {
  constructor(
    readonly provider: string,
    readonly plannedPhase: string,
  ) {
    super(
      `The "${provider}" live provider is not implemented yet (planned for ${plannedPhase}). ` +
        `Set PROVIDER_MODE=mock to run with deterministic fixtures.`,
    );
    this.name = 'ProviderNotImplementedError';
  }
}
