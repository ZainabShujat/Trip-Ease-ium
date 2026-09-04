import { describe, expect, it } from 'vitest';
import { rupees } from '@/lib/money';
import {
  CreateTripFormSchema,
  SUPPORTED_DESTINATIONS,
  briefFromForm,
} from '@/server/trips/service';
import {
  CredentialsSchema,
  RegisterSchema,
  hashPassword,
  verifyPassword,
} from '@/server/auth/config';
import { findFixture } from '@/providers/mock/fixtures/registry';

/**
 * The form boundary and password handling.
 *
 * This is where a person's typing becomes engine input. Getting the unit
 * conversion wrong here would be invisible — the plan would simply be built
 * against a budget a hundred times too small.
 */

const VALID_FORM = {
  originCity: 'Delhi',
  destinationCity: 'Manali',
  startDate: '2026-10-12',
  endDate: '2026-10-17',
  travellerCount: '4',
  budgetRupees: '40000',
};

describe('create-trip form validation', () => {
  it('accepts a well-formed submission and coerces the numbers', () => {
    const parsed = CreateTripFormSchema.parse(VALID_FORM);
    expect(parsed.travellerCount).toBe(4);
    expect(parsed.budgetRupees).toBe(40_000);
    expect(parsed.pace).toBe('BALANCED');
  });

  it('rejects an end date before the start date', () => {
    const result = CreateTripFormSchema.safeParse({ ...VALID_FORM, endDate: '2026-10-11' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toMatch(/end date/i);
    }
  });

  it('rejects a zero or negative party', () => {
    expect(CreateTripFormSchema.safeParse({ ...VALID_FORM, travellerCount: '0' }).success).toBe(
      false,
    );
    expect(CreateTripFormSchema.safeParse({ ...VALID_FORM, travellerCount: '-2' }).success).toBe(
      false,
    );
  });

  it('rejects an empty destination', () => {
    expect(CreateTripFormSchema.safeParse({ ...VALID_FORM, destinationCity: '' }).success).toBe(
      false,
    );
  });

  it('rejects a trip longer than the supported window', () => {
    expect(CreateTripFormSchema.safeParse({ ...VALID_FORM, endDate: '2026-12-31' }).success).toBe(
      false,
    );
  });

  it('gives a usable message for each bad field rather than a generic failure', () => {
    const result = CreateTripFormSchema.safeParse({ ...VALID_FORM, budgetRupees: '0' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBeTruthy();
    }
  });
});

describe('form to TripBrief', () => {
  it('converts rupees to paise', () => {
    // The conversion that would otherwise silently plan a ₹400 trip.
    const brief = briefFromForm(CreateTripFormSchema.parse(VALID_FORM));
    expect(brief.budgetTotalMinor).toBe(rupees(40_000));
    expect(brief.budgetTotalMinor).toBe(4_000_000);
  });

  it('attaches coordinates for known cities', () => {
    const brief = briefFromForm(CreateTripFormSchema.parse(VALID_FORM));
    expect(brief.origin.geo).toBeDefined();
    expect(brief.destination.geo).toBeDefined();
    expect(brief.destination.geo!.lat).toBeCloseTo(32.24, 1);
  });

  it('omits coordinates for an unknown city rather than guessing', () => {
    const brief = briefFromForm(
      CreateTripFormSchema.parse({ ...VALID_FORM, originCity: 'Atlantis' }),
    );
    expect(brief.origin.geo).toBeUndefined();
  });

  it('trims whitespace from city names', () => {
    const brief = briefFromForm(
      CreateTripFormSchema.parse({ ...VALID_FORM, originCity: '  Delhi  ' }),
    );
    expect(brief.origin.name).toBe('Delhi');
    expect(brief.origin.geo).toBeDefined();
  });

  it('carries preferences through unchanged', () => {
    const brief = briefFromForm(
      CreateTripFormSchema.parse({
        ...VALID_FORM,
        pace: 'RELAXED',
        lodgingTier: 'BUDGET',
        interests: ['NATURE', 'CAFES'],
        transportModes: ['BUS'],
        avoidOvernightTransport: 'true',
        wakeTime: '09:30',
      }),
    );
    expect(brief.pace).toBe('RELAXED');
    expect(brief.lodgingTier).toBe('BUDGET');
    expect(brief.interests).toEqual(['NATURE', 'CAFES']);
    expect(brief.transportModes).toEqual(['BUS']);
    expect(brief.avoidOvernightTransport).toBe(true);
    expect(brief.wakeTime).toBe('09:30');
  });

  it('produces a brief the engine schema accepts', () => {
    // briefFromForm parses through TripBriefSchema, so a shape mismatch throws
    // here rather than deep inside the pipeline.
    expect(() => briefFromForm(CreateTripFormSchema.parse(VALID_FORM))).not.toThrow();
  });
});

describe('supported destinations', () => {
  it('only advertises destinations the providers can actually plan', () => {
    // Offering a city the mock provider does not know would produce a
    // NO_CANDIDATES failure after the user filled in the whole form.
    for (const city of SUPPORTED_DESTINATIONS) {
      expect(findFixture(city), city).toBeDefined();
    }
  });
});

describe('password handling', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('wrong password here', hash)).toBe(false);
  });

  it('produces a different hash each time', async () => {
    // Salted, so two users with the same password do not share a hash.
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same password', a)).toBe(true);
    expect(await verifyPassword('same password', b)).toBe(true);
  });

  it('never returns the password in the hash', async () => {
    const hash = await hashPassword('supersecret123');
    expect(hash).not.toContain('supersecret123');
  });
});

describe('credentials validation', () => {
  it('requires a plausible email and a minimum password length', () => {
    expect(CredentialsSchema.safeParse({ email: 'a@b.co', password: 'longenough' }).success).toBe(
      true,
    );
    expect(CredentialsSchema.safeParse({ email: 'nope', password: 'longenough' }).success).toBe(
      false,
    );
    expect(CredentialsSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });

  it('requires a name to register', () => {
    expect(
      RegisterSchema.safeParse({ email: 'a@b.co', password: 'longenough', name: '' }).success,
    ).toBe(false);
    expect(
      RegisterSchema.safeParse({ email: 'a@b.co', password: 'longenough', name: 'Zainab' }).success,
    ).toBe(true);
  });
});
