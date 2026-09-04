import { nightsBetween, type GeoPoint, type Poi, type TripBrief } from '@/lib/schemas';
import type { SourcedCandidates } from '@/engine/types';
import type { ProviderSet } from '@/providers/types';

/**
 * The source / normalisation layer.
 *
 * This is the ONLY place that calls providers on the engine's behalf. It sits
 * outside `src/engine` deliberately: the ESLint rule forbids the engine from
 * importing providers, which is what keeps the engine testable with plain
 * data and no I/O. Everything here is orchestration — fetch, normalise, hand
 * over — and no planning decision is taken.
 *
 * Provenance from each feed is collected and passed through, so a plan built
 * on estimated travel times still knows that about itself at the far end.
 */

export interface GatherOptions {
  /** Search radius for places around the destination. */
  radiusMetres?: number;
  /** Cap on POI candidates fetched before scoring. */
  poiLimit?: number;
}

/** Destination coordinates, from the brief or inferred from what came back. */
function resolveDestinationGeo(brief: TripBrief, pois: readonly Poi[]): GeoPoint {
  if (brief.destination.geo) return brief.destination.geo;
  if (pois.length > 0) {
    return {
      lat: pois.reduce((s, p) => s + p.geo.lat, 0) / pois.length,
      lng: pois.reduce((s, p) => s + p.geo.lng, 0) / pois.length,
    };
  }
  return { lat: 0, lng: 0 };
}

export async function gatherCandidates(
  brief: TripBrief,
  providers: ProviderSet,
  options: GatherOptions = {},
): Promise<SourcedCandidates> {
  const checkOut = brief.endDate;
  const radiusMetres = options.radiusMetres ?? 25_000;
  const poiLimit = options.poiLimit ?? 60;

  // A same-day trip needs no accommodation, and asking a provider for a
  // zero-night stay is a bad question rather than an error condition. Skip it
  // and let the engine report NO_CANDIDATES — day trips are out of MVP scope
  // and saying so plainly beats throwing from inside a provider.
  const needsLodging = nightsBetween(brief.startDate, checkOut) > 0;

  // Providers are independent; fetch concurrently. A real integration would
  // also share a cache here.
  const [outbound, inbound, local, lodging] = await Promise.all([
    providers.transport.searchIntercity({
      fromCity: brief.origin.name,
      toCity: brief.destination.name,
      date: brief.startDate,
      direction: 'OUTBOUND',
      passengers: brief.travellerCount,
      avoidOvernight: brief.avoidOvernightTransport,
      ...(brief.transportModes.length > 0 ? { modes: brief.transportModes } : {}),
    }),
    providers.transport.searchIntercity({
      fromCity: brief.destination.name,
      toCity: brief.origin.name,
      date: brief.endDate,
      direction: 'RETURN',
      passengers: brief.travellerCount,
      avoidOvernight: brief.avoidOvernightTransport,
      ...(brief.transportModes.length > 0 ? { modes: brief.transportModes } : {}),
    }),
    providers.transport.searchLocal({
      city: brief.destination.name,
      passengers: brief.travellerCount,
    }),
    needsLodging
      ? providers.lodging.search({
          city: brief.destination.name,
          checkIn: brief.startDate,
          checkOut,
          guests: brief.travellerCount,
          limit: 20,
        })
      : Promise.resolve({
          data: [],
          sourceKind: 'mock' as const,
          provider: 'none',
          fetchedAt: '2026-01-01T00:00:00+05:30',
          confidence: 'low' as const,
        }),
  ]);

  const placesQuery = {
    near: brief.destination.geo ?? { lat: 0, lng: 0 },
    radiusMetres,
    limit: poiLimit,
  };
  const places = await providers.places.search(
    brief.destination.geo
      ? placesQuery
      : { ...placesQuery, near: resolveDestinationGeo(brief, []) },
  );

  // One matrix for the whole trip: every candidate POI plus every candidate
  // hotel, so scheduling and lodging proximity read from the same numbers.
  const matrixPoints: GeoPoint[] = [
    ...lodging.data.map((l) => l.geo),
    ...places.data.map((p) => p.geo),
  ];
  const matrix = await providers.routing.matrix(
    matrixPoints.length > 0 ? matrixPoints : [resolveDestinationGeo(brief, places.data)],
    'CAR',
  );

  return {
    outboundTransport: outbound.data,
    returnTransport: inbound.data,
    localTransport: local.data,
    lodging: lodging.data,
    pois: places.data,
    matrix: matrix.data,
    provenance: {
      transport: {
        sourceKind: outbound.sourceKind,
        provider: outbound.provider,
        fetchedAt: outbound.fetchedAt,
        confidence: outbound.confidence,
      },
      lodging: {
        sourceKind: lodging.sourceKind,
        provider: lodging.provider,
        fetchedAt: lodging.fetchedAt,
        confidence: lodging.confidence,
      },
      places: {
        sourceKind: places.sourceKind,
        provider: places.provider,
        fetchedAt: places.fetchedAt,
        confidence: places.confidence,
      },
      routing: {
        sourceKind: matrix.sourceKind,
        provider: matrix.provider,
        fetchedAt: matrix.fetchedAt,
        confidence: matrix.confidence,
      },
    },
  };
}
