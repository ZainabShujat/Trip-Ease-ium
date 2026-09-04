import { describe, expect, it } from 'vitest';
import { LodgingTierSchema, PoiSchema } from '@/lib/schemas';
import { estimateLeg } from '@/providers/mock/geo';
import {
  DELHI_MANALI,
  DELHI_MANALI_SERVICES,
  MANALI_LOCAL_TRANSPORT,
  MANALI_LODGING,
  MANALI_POIS,
} from './fixtures/delhi-manali';

/**
 * Fixture validity.
 *
 * The Delhi → Manali fixture is the corpus every later phase is tested
 * against, so it has to be checked like production data. A POI with swapped
 * coordinates or an impossible opening time would produce a plausible-looking
 * itinerary that is quietly wrong — which is the failure mode this project
 * exists to prevent.
 */

describe('Delhi → Manali fixture', () => {
  it('has the volume the architecture calls for', () => {
    expect(MANALI_POIS.length).toBeGreaterThanOrEqual(20);
    expect(MANALI_LODGING.length).toBeGreaterThanOrEqual(6);
    expect(DELHI_MANALI_SERVICES.length).toBeGreaterThanOrEqual(5);
    expect(MANALI_LOCAL_TRANSPORT.length).toBeGreaterThanOrEqual(4);
  });

  describe('points of interest', () => {
    it('every POI satisfies the domain schema', () => {
      for (const poi of MANALI_POIS) {
        const result = PoiSchema.safeParse(poi);
        if (!result.success) {
          throw new Error(`${poi.id} is invalid: ${JSON.stringify(result.error.issues)}`);
        }
      }
    });

    it('ids and provider references are unique', () => {
      expect(new Set(MANALI_POIS.map((p) => p.id)).size).toBe(MANALI_POIS.length);
      expect(new Set(MANALI_POIS.map((p) => p.providerRef)).size).toBe(MANALI_POIS.length);
    });

    it('every coordinate falls inside the Kullu–Manali valley', () => {
      // Catches transposed lat/lng and stray digits — the classic way a
      // fixture ends up routing a traveller through the Bay of Bengal.
      for (const poi of MANALI_POIS) {
        expect(poi.geo.lat, `${poi.name} latitude`).toBeGreaterThan(32.0);
        expect(poi.geo.lat, `${poi.name} latitude`).toBeLessThan(32.5);
        expect(poi.geo.lng, `${poi.name} longitude`).toBeGreaterThan(77.0);
        expect(poi.geo.lng, `${poi.name} longitude`).toBeLessThan(77.4);
      }
    });

    it('every POI is within 40 km of central Manali', () => {
      const manali = DELHI_MANALI.destination.geo;
      for (const poi of MANALI_POIS) {
        const { distanceMetres } = estimateLeg(manali, poi.geo, 'CAR');
        expect(distanceMetres, `${poi.name} is unreasonably far`).toBeLessThan(40_000);
      }
    });

    it('every visit duration is plausible', () => {
      for (const poi of MANALI_POIS) {
        expect(poi.typicalDurationMins, poi.name).toBeGreaterThanOrEqual(15);
        expect(poi.typicalDurationMins, poi.name).toBeLessThanOrEqual(360);
      }
    });

    it('every place is open long enough for a typical visit', () => {
      // A POI that takes 3 hours but opens for 2 would make every schedule
      // containing it infeasible, for a reason no one would think to look for.
      for (const poi of MANALI_POIS) {
        if (poi.openingHours.kind !== 'weekly') continue;
        for (const interval of poi.openingHours.intervals) {
          const [oh, om] = interval.opens.split(':').map(Number);
          const [ch, cm] = interval.closes.split(':').map(Number);
          const windowMins = ch! * 60 + cm! - (oh! * 60 + om!);
          expect(windowMins, `${poi.name} window`).toBeGreaterThanOrEqual(poi.typicalDurationMins);
        }
      }
    });

    it('marks all fixture data as mock provenance', () => {
      // The UI keys off this. If a fixture ever claimed 'live', it would be
      // rendered as real availability.
      for (const poi of MANALI_POIS) {
        expect(poi.provenance.sourceKind, poi.name).toBe('mock');
      }
    });

    it('covers the categories a varied itinerary needs', () => {
      const categories = new Set(MANALI_POIS.map((p) => p.category));
      for (const required of ['TEMPLE', 'NATURE', 'CAFE', 'RESTAURANT', 'SHOPPING', 'ACTIVITY']) {
        expect(categories.has(required as never), `missing ${required}`).toBe(true);
      }
    });

    it('offers enough meal options to schedule lunch and dinner', () => {
      const eateries = MANALI_POIS.filter(
        (p) => p.category === 'RESTAURANT' || p.category === 'CAFE',
      );
      expect(eateries.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('lodging', () => {
    it('ids are unique and tiers are valid', () => {
      expect(new Set(MANALI_LODGING.map((l) => l.id)).size).toBe(MANALI_LODGING.length);
      for (const lodge of MANALI_LODGING) {
        expect(LodgingTierSchema.safeParse(lodge.tier).success, lodge.name).toBe(true);
      }
    });

    it('spans all three tiers so archetypes can be offered', () => {
      const tiers = new Set(MANALI_LODGING.map((l) => l.tier));
      expect(tiers).toEqual(new Set(['BUDGET', 'MID', 'PREMIUM']));
    });

    it('rates are integers in a plausible band', () => {
      for (const lodge of MANALI_LODGING) {
        expect(Number.isInteger(lodge.nightlyRateMinor), lodge.name).toBe(true);
        expect(lodge.nightlyRateMinor).toBeGreaterThanOrEqual(100_000); // ₹1,000
        expect(lodge.nightlyRateMinor).toBeLessThanOrEqual(1_500_000); // ₹15,000
      }
    });

    it('is priced consistently with its tier', () => {
      const budget = MANALI_LODGING.filter((l) => l.tier === 'BUDGET');
      const premium = MANALI_LODGING.filter((l) => l.tier === 'PREMIUM');
      const maxBudget = Math.max(...budget.map((l) => l.nightlyRateMinor));
      const minPremium = Math.min(...premium.map((l) => l.nightlyRateMinor));
      expect(maxBudget).toBeLessThan(minPremium);
    });
  });

  describe('intercity transport', () => {
    it('durations sit in the real 12–16 hour band for the route', () => {
      for (const svc of DELHI_MANALI_SERVICES) {
        expect(svc.durationMins, svc.operator).toBeGreaterThanOrEqual(11 * 60);
        expect(svc.durationMins, svc.operator).toBeLessThanOrEqual(17 * 60);
      }
    });

    it('fares are integers in a plausible band', () => {
      for (const svc of DELHI_MANALI_SERVICES) {
        expect(Number.isInteger(svc.pricePerPersonMinor), svc.operator).toBe(true);
        expect(svc.pricePerPersonMinor).toBeGreaterThanOrEqual(50_000); // ₹500
        expect(svc.pricePerPersonMinor).toBeLessThanOrEqual(1_000_000); // ₹10,000
      }
    });

    it('departure templates are valid HH:MM', () => {
      for (const svc of DELHI_MANALI_SERVICES) {
        expect(svc.departTime, svc.operator).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      }
    });

    it('includes at least one daytime service', () => {
      // Without one, "we do not want overnight buses" has no valid answer.
      expect(DELHI_MANALI_SERVICES.some((s) => !s.isOvernight)).toBe(true);
    });

    it('cheapest and fastest are different services', () => {
      // If they were the same, there would be no trade-off to present and the
      // three-archetype UI would be meaningless.
      const byPrice = [...DELHI_MANALI_SERVICES].sort(
        (a, b) => a.pricePerPersonMinor - b.pricePerPersonMinor,
      );
      const byTime = [...DELHI_MANALI_SERVICES].sort((a, b) => a.durationMins - b.durationMins);
      expect(byPrice[0]!.id).not.toBe(byTime[0]!.id);
    });
  });
});
