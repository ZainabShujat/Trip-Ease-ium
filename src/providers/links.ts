import type { ExternalLink, GeoPoint, IsoDate, TransportMode } from '@/lib/schemas';

/**
 * THE ONLY PLACE IN THIS APPLICATION THAT PRODUCES A URL.
 *
 * Architecture rules §15.10 and §15.11: never fabricate a booking URL, never
 * present an invented link as real. Two mechanisms enforce that here.
 *
 *   1. Every link is built from a template below. There is no function that
 *      accepts an arbitrary URL string and returns a link, so no LLM output,
 *      provider payload or user input can become a button in the UI without
 *      passing through this file.
 *
 *   2. Every link declares what it honestly is. A `deeplink` lands on the
 *      exact thing; a `search` lands on pre-filled results; a `landing` lands
 *      on a home page. The UI labels each differently, so "Search on redBus"
 *      never masquerades as "Book this bus".
 *
 * When a trustworthy URL cannot be produced, these functions return `null`.
 * Null is a correct answer and the UI handles it — it is never a reason to
 * guess at a URL shape.
 *
 * ON DEEP LINKS TO BOOKING SITES: Indian travel operators (redBus, IRCTC,
 * MakeMyTrip) do not publish stable URL formats for pre-filled searches. We
 * therefore link to their entry points rather than inventing a query string
 * that would break or, worse, land the user on the wrong route. Google's Maps
 * URLs are documented and parameterised, so those are genuine deep links.
 */

/** Hosts this application is permitted to link to. */
export const LINK_HOST_WHITELIST = [
  'www.google.com',
  'maps.google.com',
  'www.booking.com',
  'www.redbus.in',
  'www.irctc.co.in',
  'www.openstreetmap.org',
] as const;

const WHITELIST: ReadonlySet<string> = new Set(LINK_HOST_WHITELIST);

/**
 * Used by the validator to catch a URL that reached persistence from anywhere
 * other than this module — the tripwire for a fabricated link.
 */
export function isWhitelistedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && WHITELIST.has(parsed.hostname);
  } catch {
    return false;
  }
}

function link(
  url: string,
  label: string,
  provider: string,
  kind: ExternalLink['kind'],
): ExternalLink | null {
  // Belt and braces: even our own templates are checked before they escape.
  return isWhitelistedUrl(url) ? { url, label, provider, kind } : null;
}

const coord = (geo: GeoPoint) => `${geo.lat.toFixed(6)},${geo.lng.toFixed(6)}`;

// ---------------------------------------------------------------------------
// Maps — genuine, documented deep links
// ---------------------------------------------------------------------------

/**
 * Google Maps Search URL. Documented and stable, so this genuinely lands on
 * the place. Coordinates are used rather than the name because a name alone
 * can resolve to the wrong "Riverside Café".
 */
export function mapsPlaceLink(geo: GeoPoint): ExternalLink | null {
  const params = new URLSearchParams({ api: '1', query: coord(geo) });
  return link(
    `https://www.google.com/maps/search/?${params.toString()}`,
    'Open in Maps',
    'Google Maps',
    'deeplink',
  );
}

const MAPS_TRAVEL_MODE: Partial<Record<TransportMode, string>> = {
  CAR: 'driving',
  TAXI: 'driving',
  AUTO_RICKSHAW: 'driving',
  SCOOTER: 'driving',
  BUS: 'transit',
  TRAIN: 'transit',
  WALK: 'walking',
};

/** Google Maps Directions URL. Also documented and parameterised. */
export function mapsDirectionsLink(
  from: GeoPoint,
  to: GeoPoint,
  mode: TransportMode = 'CAR',
): ExternalLink | null {
  const params = new URLSearchParams({
    api: '1',
    origin: coord(from),
    destination: coord(to),
    travelmode: MAPS_TRAVEL_MODE[mode] ?? 'driving',
  });
  return link(
    `https://www.google.com/maps/dir/?${params.toString()}`,
    'Directions',
    'Google Maps',
    'deeplink',
  );
}

// ---------------------------------------------------------------------------
// Accommodation — a real search URL, honestly labelled as a search
// ---------------------------------------------------------------------------

export function lodgingSearchLink(args: {
  city: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  guests: number;
  propertyName?: string;
}): ExternalLink | null {
  const query = args.propertyName ? `${args.propertyName}, ${args.city}` : args.city;
  const params = new URLSearchParams({
    ss: query,
    checkin: args.checkIn,
    checkout: args.checkOut,
    group_adults: String(args.guests),
  });
  return link(
    `https://www.booking.com/searchresults.html?${params.toString()}`,
    'Search on Booking.com',
    'Booking.com',
    'search',
  );
}

// ---------------------------------------------------------------------------
// Intercity transport — entry points only, deliberately
// ---------------------------------------------------------------------------

/**
 * redBus does not document a stable pre-filled search URL, so this returns the
 * site entry point and says so. Inventing `/bus-tickets/delhi-to-manali?doj=…`
 * would look more impressive and would be exactly the fabrication the
 * architecture forbids.
 */
export function busOperatorLink(): ExternalLink | null {
  return link('https://www.redbus.in/', 'Check buses on redBus', 'redBus', 'landing');
}

export function railOperatorLink(): ExternalLink | null {
  return link(
    'https://www.irctc.co.in/nget/train-search',
    'Check trains on IRCTC',
    'IRCTC',
    'landing',
  );
}

/** Last resort: a pre-filled web search. Honest, and never a fake booking. */
export function webSearchLink(query: string, label = 'Search the web'): ExternalLink | null {
  const params = new URLSearchParams({ q: query });
  return link(`https://www.google.com/search?${params.toString()}`, label, 'Google', 'search');
}

/**
 * Best available link for an intercity service, given its mode.
 * Returns null rather than guessing when nothing trustworthy applies.
 */
export function transportLink(args: {
  mode: TransportMode;
  fromCity: string;
  toCity: string;
  date: IsoDate;
}): ExternalLink | null {
  switch (args.mode) {
    case 'BUS':
      return busOperatorLink();
    case 'TRAIN':
      return railOperatorLink();
    case 'CAR':
    case 'TAXI':
      return webSearchLink(
        `taxi ${args.fromCity} to ${args.toCity} ${args.date}`,
        'Search for cabs',
      );
    case 'FLIGHT':
    case 'AUTO_RICKSHAW':
    case 'SCOOTER':
    case 'WALK':
      return null;
    default:
      return null;
  }
}
