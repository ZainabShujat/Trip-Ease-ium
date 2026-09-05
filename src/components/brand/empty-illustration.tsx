/**
 * The brand moment for empty states.
 *
 * A larger, quieter cousin of the logo mark: the trapezium frame, an empty
 * landscape, and a route that has not been walked yet. It appears where a
 * person has nothing — no trips, no results — which is exactly where a product
 * either feels considered or feels unfinished.
 *
 * Deliberately lower contrast than the mark itself, so it sets a mood without
 * competing with the call to action sitting under it.
 */
export function EmptyTripIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 130"
      className={className}
      fill="none"
      role="img"
      aria-label="An empty trapezium frame with a mountain landscape and an unwalked route"
    >
      <defs>
        <clipPath id="tei-empty-clip">
          <path d="M56 16 H144 L166 108 H34 Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#tei-empty-clip)">
        <rect x="0" y="0" width="200" height="130" fill="var(--peach-soft)" />
        <circle cx="86" cy="44" r="13" fill="var(--peach)" />
        <path d="M28 84 L62 44 L82 68 L96 54 L124 84 Z" fill="var(--sage)" opacity="0.55" />
        <path
          d="M24 112 C58 90 88 100 116 86 C142 73 166 82 178 76 L178 116 H24 Z"
          fill="var(--sage)"
          opacity="0.35"
        />
      </g>

      {/* The route, faint — the journey not yet taken. */}
      <path
        d="M52 100 C78 96 74 76 96 70 C120 63 116 44 140 38"
        stroke="var(--sage-deep)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="4 6"
        opacity="0.65"
      />

      <path
        d="M56 16 H144 L166 108 H34 Z"
        stroke="var(--forest)"
        strokeWidth="3.2"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* One pin, waiting. */}
      <g opacity="0.9">
        <path
          d="M146 22 c-5 0-9 4-9 9 0 6.8 9 16 9 16 s9-9.2 9-16 c0-5-4-9-9-9 Z"
          fill="var(--terracotta)"
        />
        <circle cx="146" cy="31" r="3.4" fill="var(--surface)" />
      </g>
    </svg>
  );
}
