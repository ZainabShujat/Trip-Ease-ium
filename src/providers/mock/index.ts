import {
  addDays,
  nightsBetween,
  type GeoPoint,
  type IntercityQuery,
  type IsoDate,
  type LocalTransportQuery,
  type LodgingOption,
  type LodgingQuery,
  type PlaceQuery,
  type Poi,
  type Provenance,
  type Sourced,
  type TransportMode,
  type TransportOption,
  type TravelLeg,
  type TravelMatrix,
} from '@/lib/schemas';
import { lodgingSearchLink, mapsPlaceLink, transportLink } from '../links';
import type {
  DailyWeather,
  LodgingProvider,
  PlacesProvider,
  ProviderSet,
  RoutingProvider,
  TransportProvider,
  WeatherProvider,
} from '../types';
import { ProviderUnavailableError } from '../types';
import { FIXTURES_BY_DESTINATION, findFixture } from './fixtures/registry';
import { centroid, estimateLeg } from './geo';

/**
 * Deterministic mock providers.
 *
 * These satisfy the same interfaces the real Phase 5 integrations will, and
 * make ZERO network calls and require ZERO API keys. Every value they return
 * is tagged `mock` or `estimated`, so nothing here can be rendered as live
 * availability.
 *
 * Determinism is a hard requirement, not a convenience: the engine's golden
 * tests compare exact itineraries, and a provider that returned a different
 * ordering or a jittered price between runs would make those tests useless.
 * Nothing in this file reads the clock or calls Math.random().
 */

/** Fixed timestamp so provenance is stable across runs. */
const FIXTURE_FETCHED_AT = '2026-01-01T00:00:00+05:30';

const MOCK_PROVENANCE: Provenance = {
  sourceKind: 'mock',
  provider: 'mock',
  fetchedAt: FIXTURE_FETCHED_AT,
  confidence: 'medium',
};

const ESTIMATED_PROVENANCE: Provenance = {
  sourceKind: 'estimated',
  provider: 'mock-routing',
  fetchedAt: FIXTURE_FETCHED_AT,
  confidence: 'low',
};

function wrap<T>(data: T, provenance: Provenance): Sourced<T> {
  return {
    data,
    sourceKind: provenance.sourceKind,
    provider: provenance.provider,
    fetchedAt: provenance.fetchedAt,
    confidence: provenance.confidence,
  };
}

/** Combine a local HH:MM template with a date, in IST. */
function atLocalTime(date: IsoDate, time: string): string {
  return `${date}T${time}:00+05:30`;
}

/** Add minutes to a local-IST instant and return an ISO string with offset. */
function addMinutesIso(iso: string, minutes: number): string {
  const shifted = new Date(Date.parse(iso) + minutes * 60_000);
  // Render back in +05:30 so the value stays readable as local time.
  const ist = new Date(shifted.getTime() + 5.5 * 3_600_000);
  return `${ist.toISOString().slice(0, 19)}+05:30`;
}

// ===========================================================================
// Transport
// ===========================================================================

export class MockTransportProvider implements TransportProvider {
  readonly name = 'mock-transport';
  readonly defaultSourceKind = 'mock' as const;

  isConfigured(): boolean {
    return true;
  }

  async searchIntercity(query: IntercityQuery): Promise<Sourced<TransportOption[]>> {
    const fixture = findFixture(query.toCity) ?? findFixture(query.fromCity);
    if (!fixture) {
      throw new ProviderUnavailableError(
        this.name,
        `no fixture for the route ${query.fromCity} → ${query.toCity}. ` +
          `The mock provider knows: ${Object.keys(FIXTURES_BY_DESTINATION).join(', ')}.`,
      );
    }

    const outbound = query.direction !== 'RETURN';
    const fromName = outbound ? fixture.origin.name : fixture.destination.name;
    const toName = outbound ? fixture.destination.name : fixture.origin.name;

    const options: TransportOption[] = fixture.intercity
      .filter((svc) => !query.modes || query.modes.includes(svc.mode))
      .filter((svc) => !(query.avoidOvernight && svc.isOvernight))
      .filter(
        (svc) =>
          query.maxPricePerPersonMinor === undefined ||
          svc.pricePerPersonMinor <= query.maxPricePerPersonMinor,
      )
      .map((svc) => {
        const departAt = atLocalTime(query.date, svc.departTime);
        return {
          id: `${svc.id}-${query.direction.toLowerCase()}`,
          direction: query.direction,
          mode: svc.mode,
          operator: svc.operator,
          fromName,
          toName,
          fromGeo: outbound ? fixture.origin.geo : fixture.destination.geo,
          toGeo: outbound ? fixture.destination.geo : fixture.origin.geo,
          departAt,
          arriveAt: addMinutesIso(departAt, svc.durationMins),
          durationMins: svc.durationMins,
          pricePerPersonMinor: svc.pricePerPersonMinor,
          comfortTier: svc.comfortTier,
          isOvernight: svc.isOvernight,
          link: transportLink({
            mode: svc.mode,
            fromCity: fromName,
            toCity: toName,
            date: query.date,
          }),
          notes: svc.note,
          providerRef: svc.id,
          provenance: MOCK_PROVENANCE,
        } satisfies TransportOption;
      })
      // Stable ordering — cheapest first, then by departure, so the output is
      // byte-identical between runs.
      .sort(
        (a, b) =>
          a.pricePerPersonMinor - b.pricePerPersonMinor || a.departAt.localeCompare(b.departAt),
      );

    return wrap(options, MOCK_PROVENANCE);
  }

  async searchLocal(query: LocalTransportQuery): Promise<Sourced<TransportOption[]>> {
    const fixture = findFixture(query.city);
    if (!fixture) {
      throw new ProviderUnavailableError(
        this.name,
        `no local transport fixture for ${query.city}.`,
      );
    }

    const options: TransportOption[] = fixture.localTransport.map((local) => ({
      id: local.id,
      direction: 'LOCAL' as const,
      mode: local.mode,
      operator: local.operator,
      fromName: query.city,
      toName: query.city,
      durationMins: 0,
      pricePerPersonMinor: local.pricePerPersonMinor,
      comfortTier: local.comfortTier,
      isOvernight: false,
      link: null,
      notes: local.note,
      providerRef: local.id,
      provenance: MOCK_PROVENANCE,
    }));

    return wrap(options, MOCK_PROVENANCE);
  }
}

// ===========================================================================
// Lodging
// ===========================================================================

export class MockLodgingProvider implements LodgingProvider {
  readonly name = 'mock-lodging';
  readonly defaultSourceKind = 'mock' as const;

  isConfigured(): boolean {
    return true;
  }

  async search(query: LodgingQuery): Promise<Sourced<LodgingOption[]>> {
    const fixture = findFixture(query.city);
    if (!fixture) {
      throw new ProviderUnavailableError(this.name, `no lodging fixture for ${query.city}.`);
    }

    const nights = nightsBetween(query.checkIn, query.checkOut);
    if (nights <= 0) {
      throw new ProviderUnavailableError(
        this.name,
        `checkOut (${query.checkOut}) must be after checkIn (${query.checkIn}).`,
      );
    }

    const options: LodgingOption[] = fixture.lodging
      .filter((seed) => !query.tier || seed.tier === query.tier)
      .filter(
        (seed) =>
          query.maxNightlyRateMinor === undefined ||
          seed.nightlyRateMinor <= query.maxNightlyRateMinor,
      )
      .map((seed) => {
        // Stay totals are arithmetic, computed here rather than stored.
        const roomsRequired = Math.ceil(query.guests / seed.occupancyPerRoom);
        return {
          id: seed.id,
          name: seed.name,
          geo: seed.geo,
          address: seed.address,
          area: seed.area,
          nightlyRateMinor: seed.nightlyRateMinor,
          totalRateMinor: seed.nightlyRateMinor * nights * roomsRequired,
          roomsRequired,
          rating: seed.rating,
          reviewCount: seed.reviewCount,
          tier: seed.tier,
          amenities: seed.amenities,
          checkInTime: seed.checkInTime,
          checkOutTime: seed.checkOutTime,
          link: lodgingSearchLink({
            city: query.city,
            checkIn: query.checkIn,
            checkOut: query.checkOut,
            guests: query.guests,
            propertyName: seed.name,
          }),
          providerRef: seed.id,
          provenance: MOCK_PROVENANCE,
        } satisfies LodgingOption;
      })
      .sort((a, b) => a.nightlyRateMinor - b.nightlyRateMinor || a.id.localeCompare(b.id))
      .slice(0, query.limit);

    return wrap(options, MOCK_PROVENANCE);
  }
}

// ===========================================================================
// Places
// ===========================================================================

export class MockPlacesProvider implements PlacesProvider {
  readonly name = 'mock-places';
  readonly defaultSourceKind = 'mock' as const;

  isConfigured(): boolean {
    return true;
  }

  async search(query: PlaceQuery): Promise<Sourced<Poi[]>> {
    // The mock corpus is small enough to scan; a real provider would query by
    // location server-side.
    const all = Object.values(POI_CORPUS).flat();

    const text = query.text?.trim().toLowerCase();
    const results = all
      .filter((p) => !query.categories || query.categories.includes(p.category))
      .filter((p) => {
        const { distanceMetres } = estimateLeg(query.near, p.geo, 'CAR');
        return distanceMetres <= query.radiusMetres;
      })
      .filter(
        (p) =>
          !text ||
          p.name.toLowerCase().includes(text) ||
          p.tags.some((t) => t.toLowerCase().includes(text)),
      )
      .map((p) => ({ ...p, mapsUrl: mapsPlaceLink(p.geo)?.url }))
      // Deterministic: highest rated first, ties broken by id.
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.id.localeCompare(b.id))
      .slice(0, query.limit);

    return wrap(results, MOCK_PROVENANCE);
  }

  async details(providerRef: string): Promise<Sourced<Poi | null>> {
    const all = Object.values(POI_CORPUS).flat();
    const found = all.find((p) => p.providerRef === providerRef) ?? null;
    return wrap(found, MOCK_PROVENANCE);
  }
}

// ===========================================================================
// Routing
// ===========================================================================

export class MockRoutingProvider implements RoutingProvider {
  readonly name = 'mock-routing';
  /** Computed by a model, not observed. Never 'mock' — it is a real estimate. */
  readonly defaultSourceKind = 'estimated' as const;

  isConfigured(): boolean {
    return true;
  }

  async matrix(points: readonly GeoPoint[], mode: TransportMode): Promise<Sourced<TravelMatrix>> {
    if (points.length === 0) {
      throw new ProviderUnavailableError(this.name, 'matrix requires at least one point.');
    }

    const durationMins: number[][] = [];
    const distanceMetres: number[][] = [];

    for (const from of points) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];
      for (const to of points) {
        const leg = estimateLeg(from, to, mode);
        durationRow.push(leg.durationMins);
        distanceRow.push(leg.distanceMetres);
      }
      durationMins.push(durationRow);
      distanceMetres.push(distanceRow);
    }

    const matrix: TravelMatrix = {
      points: [...points],
      mode,
      durationMins,
      distanceMetres,
      provenance: ESTIMATED_PROVENANCE,
    };
    return wrap(matrix, ESTIMATED_PROVENANCE);
  }

  async leg(from: GeoPoint, to: GeoPoint, mode: TransportMode): Promise<Sourced<TravelLeg>> {
    const estimate = estimateLeg(from, to, mode);
    const leg: TravelLeg = {
      fromGeo: from,
      toGeo: to,
      mode,
      distanceMetres: estimate.distanceMetres,
      durationMins: estimate.durationMins,
      provenance: ESTIMATED_PROVENANCE,
    };
    return wrap(leg, ESTIMATED_PROVENANCE);
  }
}

// ===========================================================================
// Weather
// ===========================================================================

/**
 * Seasonal norms for the western Himalaya at ~2,000 m, by month. These are
 * climate averages, not a forecast, and are tagged `estimated` accordingly.
 */
const MONTHLY_NORMS: ReadonlyArray<{ min: number; max: number; condition: string; rain: number }> =
  [
    { min: -3, max: 9, condition: 'snow', rain: 0.35 }, // Jan
    { min: -1, max: 11, condition: 'snow', rain: 0.35 },
    { min: 3, max: 16, condition: 'cloudy', rain: 0.3 },
    { min: 7, max: 21, condition: 'clear', rain: 0.2 },
    { min: 11, max: 25, condition: 'clear', rain: 0.2 },
    { min: 14, max: 27, condition: 'cloudy', rain: 0.35 }, // Jun
    { min: 16, max: 25, condition: 'rain', rain: 0.7 },
    { min: 15, max: 24, condition: 'rain', rain: 0.7 },
    { min: 12, max: 23, condition: 'clear', rain: 0.3 },
    { min: 7, max: 20, condition: 'clear', rain: 0.15 }, // Oct
    { min: 2, max: 15, condition: 'clear', rain: 0.15 },
    { min: -1, max: 11, condition: 'snow', rain: 0.25 }, // Dec
  ];

export class MockWeatherProvider implements WeatherProvider {
  readonly name = 'mock-weather';
  readonly defaultSourceKind = 'estimated' as const;

  isConfigured(): boolean {
    return true;
  }

  async daily(_at: GeoPoint, start: IsoDate, end: IsoDate): Promise<Sourced<DailyWeather[]>> {
    const days = nightsBetween(start, end) + 1;
    if (days <= 0) {
      throw new ProviderUnavailableError(
        this.name,
        `end (${end}) must not precede start (${start}).`,
      );
    }

    const forecast: DailyWeather[] = [];
    for (let i = 0; i < days; i += 1) {
      const date = addDays(start, i);
      const monthIndex = Number(date.slice(5, 7)) - 1;
      const norm = MONTHLY_NORMS[monthIndex] ?? MONTHLY_NORMS[0]!;
      forecast.push({
        date,
        minTempC: norm.min,
        maxTempC: norm.max,
        condition: norm.condition,
        precipitationChance: norm.rain,
      });
    }

    return wrap(forecast, {
      ...ESTIMATED_PROVENANCE,
      provider: 'mock-weather',
    });
  }
}

// ===========================================================================
// Corpus & assembly
// ===========================================================================

/** Every POI the mock providers can serve, across all destinations. */
const POI_CORPUS: Record<string, Poi[]> = Object.fromEntries(
  Object.entries(FIXTURES_BY_DESTINATION).map(([city, fixture]) => [city, fixture.pois]),
);

export function createMockProviders(): ProviderSet {
  return {
    transport: new MockTransportProvider(),
    lodging: new MockLodgingProvider(),
    places: new MockPlacesProvider(),
    routing: new MockRoutingProvider(),
    weather: new MockWeatherProvider(),
  };
}

// Re-exported so tests exercise the same estimator the providers use.
export { estimateLeg, centroid };
export type { DailyWeather };
