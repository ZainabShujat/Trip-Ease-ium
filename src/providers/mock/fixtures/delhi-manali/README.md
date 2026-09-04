# Delhi → Manali development fixture

Deterministic data used by the mock providers, the Phase 2 engine tests and the
demo. **None of it is live availability.** Every record carries
`provenance.sourceKind = 'mock'` and the UI is required to badge it as such.

## What is approximately real

- **Landmark names and coordinates.** Hadimba Devi Temple, Solang Valley, Mall
  Road and the other public landmarks are real places, and their coordinates
  are accurate to roughly a hundred metres — good enough for clustering and
  travel-time estimation, not survey grade.
- **Road distances and journey times.** Delhi–Manali is ~530 km and a 12–15
  hour road journey. The durations here sit in that range.
- **Fare bands.** Bus fares in the ₹900–₹2,600 range and mid-tier Manali hotel
  rates of ₹1,800–₹6,500 a night reflect published ranges, not quotes.

## What is invented, and why

- **All hotels and all eateries have fictional names.** Attaching invented
  nightly rates, ratings and review counts to real businesses would
  misrepresent them. The coordinates place them in real neighbourhoods (Old
  Manali, Vashisht, Mall Road) so the geographic clustering has realistic
  structure to work with, but no real property is named or priced.
- **Bus operators are service classes, not companies** — "State Roadways
  (Ordinary)", "Private Volvo A/C Sleeper" — for the same reason.
- **Opening hours are typical values**, not verified schedules.

## Why this file exists

Phase 5 replaces these mock providers with Google Places and a real routing
API. The fixture stays, as the offline test corpus: the engine's golden tests
must keep passing with no network and no API key, and the demo must survive a
dead conference-centre connection.

## Structure

| File            | Contents                                              |
| --------------- | ----------------------------------------------------- |
| `pois.ts`       | 21 points of interest with coordinates and hours       |
| `lodging.ts`    | 6 properties across budget / mid / premium tiers       |
| `transport.ts`  | 7 intercity services plus 4 local transport modes      |
| `index.ts`      | Assembled `DELHI_MANALI` fixture and city coordinates  |
