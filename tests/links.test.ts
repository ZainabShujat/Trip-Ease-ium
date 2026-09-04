import { describe, expect, it } from 'vitest';
import { ExternalLinkSchema } from '@/lib/schemas';
import {
  busOperatorLink,
  isWhitelistedUrl,
  LINK_HOST_WHITELIST,
  lodgingSearchLink,
  mapsDirectionsLink,
  mapsPlaceLink,
  railOperatorLink,
  transportLink,
  webSearchLink,
} from '@/providers/links';

/**
 * The link builder is the enforcement point for architecture rules §15.10 and
 * §15.11 — never fabricate a booking URL, never present an invented link as
 * real. These tests are the guard on that.
 */

const ALL_BUILDERS = [
  mapsPlaceLink({ lat: 32.2465, lng: 77.1795 }),
  mapsDirectionsLink({ lat: 32.2432, lng: 77.1892 }, { lat: 32.317, lng: 77.158 }, 'CAR'),
  lodgingSearchLink({
    city: 'Manali',
    checkIn: '2026-10-12',
    checkOut: '2026-10-17',
    guests: 4,
  }),
  busOperatorLink(),
  railOperatorLink(),
  webSearchLink('taxi Delhi to Manali'),
];

describe('link whitelist', () => {
  it('accepts only https hosts on the list', () => {
    for (const host of LINK_HOST_WHITELIST) {
      expect(isWhitelistedUrl(`https://${host}/anything`)).toBe(true);
    }
  });

  it('rejects an off-whitelist host', () => {
    // The tripwire for a fabricated link reaching the UI.
    expect(isWhitelistedUrl('https://totally-real-bookings.example.com/bus/123')).toBe(false);
  });

  it('rejects plain http even on a whitelisted host', () => {
    expect(isWhitelistedUrl('http://www.google.com/maps')).toBe(false);
  });

  it('rejects a lookalike subdomain', () => {
    expect(isWhitelistedUrl('https://www.google.com.evil.example/maps')).toBe(false);
  });

  it('rejects malformed input rather than throwing', () => {
    expect(isWhitelistedUrl('not a url')).toBe(false);
    expect(isWhitelistedUrl('')).toBe(false);
    expect(isWhitelistedUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('every builder output', () => {
  it('satisfies the ExternalLink schema', () => {
    for (const link of ALL_BUILDERS) {
      expect(link).not.toBeNull();
      const result = ExternalLinkSchema.safeParse(link);
      if (!result.success) {
        throw new Error(`${link?.url}: ${JSON.stringify(result.error.issues)}`);
      }
    }
  });

  it('is on the whitelist', () => {
    for (const link of ALL_BUILDERS) {
      expect(isWhitelistedUrl(link!.url), link!.url).toBe(true);
    }
  });

  it('carries a label matching what the link actually does', () => {
    // A "search" link must never be labelled as though it books something.
    for (const link of ALL_BUILDERS) {
      if (link!.kind !== 'deeplink') {
        expect(link!.label.toLowerCase()).not.toMatch(/^book\b/);
      }
    }
  });
});

describe('maps links', () => {
  it('builds a place link from coordinates, not a name', () => {
    // A name alone can resolve to the wrong "Riverstone Coffee House".
    const link = mapsPlaceLink({ lat: 32.2465, lng: 77.1795 })!;
    expect(link.kind).toBe('deeplink');
    // URLSearchParams percent-encodes the comma, which is correct; assert on
    // the decoded parameter rather than the raw string.
    expect(new URL(link.url).searchParams.get('query')).toBe('32.246500,77.179500');
    expect(new URL(link.url).searchParams.get('api')).toBe('1');
  });

  it('encodes directions with a travel mode', () => {
    const link = mapsDirectionsLink(
      { lat: 32.2432, lng: 77.1892 },
      { lat: 32.317, lng: 77.158 },
      'WALK',
    )!;
    expect(link.url).toContain('travelmode=walking');
  });

  it('maps transit modes to transit directions', () => {
    const link = mapsDirectionsLink(
      { lat: 32.2432, lng: 77.1892 },
      { lat: 32.317, lng: 77.158 },
      'BUS',
    )!;
    expect(link.url).toContain('travelmode=transit');
  });
});

describe('lodging link', () => {
  it('is a search, honestly labelled', () => {
    const link = lodgingSearchLink({
      city: 'Manali',
      checkIn: '2026-10-12',
      checkOut: '2026-10-17',
      guests: 4,
      propertyName: 'Pine Hollow Guesthouse',
    })!;
    expect(link.kind).toBe('search');
    expect(link.label).toBe('Search on Booking.com');
    expect(link.url).toContain('checkin=2026-10-12');
    expect(link.url).toContain('group_adults=4');
  });

  it('url-encodes a property name with spaces and punctuation', () => {
    const link = lodgingSearchLink({
      city: 'Manali',
      checkIn: '2026-10-12',
      checkOut: '2026-10-17',
      guests: 2,
      propertyName: 'Deodar & Co. Retreat',
    })!;
    expect(() => new URL(link.url)).not.toThrow();
    expect(link.url).not.toContain(' ');
  });
});

describe('transport links', () => {
  it('sends bus travellers to redBus as a landing page, not a fake deep link', () => {
    // redBus publishes no stable pre-filled search URL. Inventing one would
    // look more impressive and would be exactly the forbidden fabrication.
    const link = transportLink({
      mode: 'BUS',
      fromCity: 'Delhi',
      toCity: 'Manali',
      date: '2026-10-12',
    })!;
    expect(link.kind).toBe('landing');
    expect(link.provider).toBe('redBus');
    expect(link.url).toBe('https://www.redbus.in/');
  });

  it('sends train travellers to IRCTC', () => {
    const link = transportLink({
      mode: 'TRAIN',
      fromCity: 'Delhi',
      toCity: 'Chandigarh',
      date: '2026-10-12',
    })!;
    expect(link.provider).toBe('IRCTC');
    expect(link.kind).toBe('landing');
  });

  it('returns null rather than guessing for modes with no sensible destination', () => {
    // Null is a correct answer; the UI renders guidance instead of a button.
    for (const mode of ['WALK', 'AUTO_RICKSHAW', 'SCOOTER', 'FLIGHT'] as const) {
      expect(
        transportLink({ mode, fromCity: 'Delhi', toCity: 'Manali', date: '2026-10-12' }),
      ).toBeNull();
    }
  });

  it('offers a web search for cabs', () => {
    const link = transportLink({
      mode: 'TAXI',
      fromCity: 'Delhi',
      toCity: 'Manali',
      date: '2026-10-12',
    })!;
    expect(link.kind).toBe('search');
    expect(link.url).toContain('q=');
  });
});
