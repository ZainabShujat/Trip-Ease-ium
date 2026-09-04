import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rupees } from '@/lib/money';
import {
  LodgingOptionSchema,
  PoiSchema,
  TransportOptionSchema,
  TravelMatrixSchema,
} from '@/lib/schemas';
import { isWhitelistedUrl } from '@/providers/links';
import { createMockProviders } from '@/providers/mock';
import { estimateLeg, haversineMetres } from '@/providers/mock/geo';
import { getProviders, resetProviderCache, resolveProviderMode } from '@/providers/registry';
import { ProviderNotImplementedError, ProviderUnavailableError } from '@/providers/types';

const providers = createMockProviders();

const OUTBOUND = {
  fromCity: 'Delhi',
  toCity: 'Manali',
  date: '2026-10-12',
  direction: 'OUTBOUND' as const,
  passengers: 4,
  avoidOvernight: false,
};

const STAY = {
  city: 'Manali',
  checkIn: '2026-10-12',
  checkOut: '2026-10-17',
  guests: 4,
  limit: 20,
};

describe('mock providers make no network calls', () => {
  beforeEach(() => {
    // Any attempt to reach the network fails the test loudly. "Works offline"
    // is a hard requirement, not an aspiration.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('a mock provider attempted a network request');
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves a full set of results with fetch disabled', async () => {
    const transport = await providers.transport.searchIntercity(OUTBOUND);
    const lodging = await providers.lodging.search(STAY);
    const places = await providers.places.search({
      near: { lat: 32.2432, lng: 77.1892 },
      radiusMetres: 25_000,
      limit: 50,
    });
    const weather = await providers.weather.daily(
      { lat: 32.2432, lng: 77.1892 },
      '2026-10-12',
      '2026-10-17',
    );

    expect(transport.data.length).toBeGreaterThan(0);
    expect(lodging.data.length).toBeGreaterThan(0);
    expect(places.data.length).toBeGreaterThan(0);
    expect(weather.data).toHaveLength(6);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('provider contracts', () => {
  it('every provider declares a name and a source kind', () => {
    for (const provider of Object.values(providers)) {
      expect(provider.name).toBeTruthy();
      expect(['live', 'cached', 'estimated', 'mock']).toContain(provider.defaultSourceKind);
      expect(provider.isConfigured()).toBe(true);
    }
  });

  it('results carry provenance, and never claim to be live', async () => {
    const result = await providers.transport.searchIntercity(OUTBOUND);
    expect(result.sourceKind).toBe('mock');
    expect(result.provider).toBeTruthy();
    expect(result.confidence).toBeTruthy();
    for (const option of result.data) {
      expect(option.provenance.sourceKind).not.toBe('live');
      expect(option.provenance.sourceKind).not.toBe('cached');
    }
  });

  it('routing declares estimated, not mock — it is a real calculation', async () => {
    const matrix = await providers.routing.matrix(
      [
        { lat: 32.24, lng: 77.18 },
        { lat: 32.31, lng: 77.15 },
      ],
      'CAR',
    );
    expect(matrix.sourceKind).toBe('estimated');
  });
});

describe('determinism', () => {
  it('returns byte-identical results across repeated calls', async () => {
    // The Phase 2 golden tests compare exact itineraries. A provider that
    // reordered results or jittered a price between runs would make them
    // worthless.
    const a = await providers.transport.searchIntercity(OUTBOUND);
    const b = await providers.transport.searchIntercity(OUTBOUND);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const l1 = await providers.lodging.search(STAY);
    const l2 = await providers.lodging.search(STAY);
    expect(JSON.stringify(l1)).toBe(JSON.stringify(l2));
  });
});

describe('transport provider', () => {
  it('output satisfies the domain schema', async () => {
    const { data } = await providers.transport.searchIntercity(OUTBOUND);
    for (const option of data) {
      const result = TransportOptionSchema.safeParse(option);
      if (!result.success) {
        throw new Error(`${option.id}: ${JSON.stringify(result.error.issues)}`);
      }
    }
  });

  it('computes arrival from departure plus duration', async () => {
    const { data } = await providers.transport.searchIntercity(OUTBOUND);
    for (const option of data) {
      const depart = Date.parse(option.departAt!);
      const arrive = Date.parse(option.arriveAt!);
      expect(arrive - depart).toBe(option.durationMins * 60_000);
    }
  });

  it('honours the avoid-overnight preference', async () => {
    const { data } = await providers.transport.searchIntercity({
      ...OUTBOUND,
      avoidOvernight: true,
    });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((o) => !o.isOvernight)).toBe(true);
  });

  it('honours a price ceiling', async () => {
    const cap = rupees(1300);
    const { data } = await providers.transport.searchIntercity({
      ...OUTBOUND,
      maxPricePerPersonMinor: cap,
    });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((o) => o.pricePerPersonMinor <= cap)).toBe(true);
  });

  it('reverses the endpoints for a return journey', async () => {
    const { data } = await providers.transport.searchIntercity({
      ...OUTBOUND,
      direction: 'RETURN',
    });
    expect(data[0]!.fromName).toBe('Manali');
    expect(data[0]!.toName).toBe('Delhi');
  });

  it('distinguishes "unknown route" from "no results"', async () => {
    // Returning an empty list here would let the UI say "no buses available",
    // which is a different and false claim.
    await expect(
      providers.transport.searchIntercity({ ...OUTBOUND, toCity: 'Reykjavik' }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('offers local transport modes for the destination', async () => {
    const { data } = await providers.transport.searchLocal({ city: 'Manali', passengers: 4 });
    expect(data.length).toBeGreaterThanOrEqual(4);
    expect(data.every((o) => o.direction === 'LOCAL')).toBe(true);
  });
});

describe('lodging provider', () => {
  it('output satisfies the domain schema', async () => {
    const { data } = await providers.lodging.search(STAY);
    for (const option of data) {
      const result = LodgingOptionSchema.safeParse(option);
      if (!result.success) {
        throw new Error(`${option.id}: ${JSON.stringify(result.error.issues)}`);
      }
    }
  });

  it('computes the stay total from nightly rate, nights and rooms', async () => {
    const { data } = await providers.lodging.search(STAY);
    const nights = 5;
    for (const option of data) {
      expect(option.totalRateMinor).toBe(option.nightlyRateMinor * nights * option.roomsRequired);
    }
  });

  it('books enough rooms for the party', async () => {
    const { data } = await providers.lodging.search(STAY);
    for (const option of data) {
      expect(option.roomsRequired).toBeGreaterThanOrEqual(1);
    }
    // A 2-per-room property must take 2 rooms for 4 guests.
    const pineHollow = data.find((o) => o.id === 'lodge-pine-hollow');
    expect(pineHollow?.roomsRequired).toBe(2);
  });

  it('filters by tier', async () => {
    const { data } = await providers.lodging.search({ ...STAY, tier: 'BUDGET' });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((o) => o.tier === 'BUDGET')).toBe(true);
  });

  it('rejects a checkout that is not after checkin', async () => {
    await expect(
      providers.lodging.search({ ...STAY, checkOut: '2026-10-12' }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('places provider', () => {
  it('output satisfies the domain schema', async () => {
    const { data } = await providers.places.search({
      near: { lat: 32.2432, lng: 77.1892 },
      radiusMetres: 25_000,
      limit: 50,
    });
    for (const poi of data) {
      expect(PoiSchema.safeParse(poi).success, poi.name).toBe(true);
    }
  });

  it('filters by category', async () => {
    const { data } = await providers.places.search({
      near: { lat: 32.2432, lng: 77.1892 },
      radiusMetres: 25_000,
      categories: ['CAFE'],
      limit: 50,
    });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((p) => p.category === 'CAFE')).toBe(true);
  });

  it('respects the search radius', async () => {
    const { data } = await providers.places.search({
      near: { lat: 32.2432, lng: 77.1892 },
      radiusMetres: 3_000,
      limit: 50,
    });
    // Rohtang is 50 km away; a 3 km radius must exclude it.
    expect(data.some((p) => p.id === 'poi-rohtang')).toBe(false);
  });

  it('returns null for an unknown reference instead of inventing a place', async () => {
    const { data } = await providers.places.details('fixture:manali:does-not-exist');
    expect(data).toBeNull();
  });

  it('attaches only whitelisted map URLs', async () => {
    const { data } = await providers.places.search({
      near: { lat: 32.2432, lng: 77.1892 },
      radiusMetres: 25_000,
      limit: 50,
    });
    for (const poi of data) {
      if (poi.mapsUrl) expect(isWhitelistedUrl(poi.mapsUrl), poi.name).toBe(true);
    }
  });
});

describe('routing provider', () => {
  it('produces a valid square matrix', async () => {
    const points = [
      { lat: 32.2432, lng: 77.1892 },
      { lat: 32.2465, lng: 77.1795 },
      { lat: 32.317, lng: 77.158 },
    ];
    const { data } = await providers.routing.matrix(points, 'CAR');
    expect(TravelMatrixSchema.safeParse(data).success).toBe(true);
    expect(data.durationMins).toHaveLength(3);
  });

  it('has a zero diagonal', async () => {
    const points = [
      { lat: 32.2432, lng: 77.1892 },
      { lat: 32.2465, lng: 77.1795 },
    ];
    const { data } = await providers.routing.matrix(points, 'CAR');
    expect(data.durationMins[0]![0]).toBe(0);
    expect(data.durationMins[1]![1]).toBe(0);
  });

  it('estimates a longer journey for a more distant place', async () => {
    const manali = { lat: 32.2432, lng: 77.1892 };
    const hadimba = estimateLeg(manali, { lat: 32.2465, lng: 77.1795 }, 'CAR');
    const solang = estimateLeg(manali, { lat: 32.317, lng: 77.158 }, 'CAR');
    expect(solang.durationMins).toBeGreaterThan(hadimba.durationMins);
  });

  it('inflates straight-line distance to account for mountain roads', async () => {
    const from = { lat: 32.2432, lng: 77.1892 };
    const to = { lat: 32.317, lng: 77.158 };
    const straight = haversineMetres(from, to);
    const { distanceMetres } = estimateLeg(from, to, 'CAR');
    expect(distanceMetres).toBeGreaterThan(straight);
  });

  it('walking takes longer than driving over the same ground', () => {
    const from = { lat: 32.2432, lng: 77.1892 };
    const to = { lat: 32.253, lng: 77.181 };
    expect(estimateLeg(from, to, 'WALK').durationMins).toBeGreaterThan(
      estimateLeg(from, to, 'CAR').durationMins,
    );
  });

  it('is symmetric and deterministic', () => {
    const a = { lat: 32.2432, lng: 77.1892 };
    const b = { lat: 32.317, lng: 77.158 };
    expect(estimateLeg(a, b, 'CAR')).toEqual(estimateLeg(b, a, 'CAR'));
    expect(estimateLeg(a, b, 'CAR')).toEqual(estimateLeg(a, b, 'CAR'));
  });
});

describe('weather provider', () => {
  it('returns one entry per day, inclusive', async () => {
    const { data, sourceKind } = await providers.weather.daily(
      { lat: 32.2432, lng: 77.1892 },
      '2026-10-12',
      '2026-10-17',
    );
    expect(data).toHaveLength(6);
    expect(data[0]!.date).toBe('2026-10-12');
    expect(data[5]!.date).toBe('2026-10-17');
    // A seasonal norm is an estimate, never a forecast.
    expect(sourceKind).toBe('estimated');
  });

  it('gives October in Manali plausible temperatures', async () => {
    const { data } = await providers.weather.daily(
      { lat: 32.2432, lng: 77.1892 },
      '2026-10-12',
      '2026-10-12',
    );
    expect(data[0]!.maxTempC).toBeGreaterThan(data[0]!.minTempC);
    expect(data[0]!.maxTempC).toBeLessThan(30);
  });
});

describe('registry', () => {
  afterEach(() => {
    resetProviderCache();
  });

  it('defaults to mock when PROVIDER_MODE is unset', () => {
    expect(resolveProviderMode({})).toBe('mock');
  });

  it('rejects an unrecognised mode rather than guessing', () => {
    expect(() => resolveProviderMode({ PROVIDER_MODE: 'production' })).toThrow();
  });

  it('refuses live mode loudly instead of silently serving mocks', () => {
    // The whole point: a demo must never present fixture data as real.
    expect(() => getProviders({ PROVIDER_MODE: 'live' })).toThrow(ProviderNotImplementedError);
  });

  it('returns a full provider set in mock mode', () => {
    const set = getProviders({ PROVIDER_MODE: 'mock' });
    expect(Object.keys(set).sort()).toEqual([
      'lodging',
      'places',
      'routing',
      'transport',
      'weather',
    ]);
  });
});
