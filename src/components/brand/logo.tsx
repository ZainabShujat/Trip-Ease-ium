import type { SVGProps } from 'react';

/**
 * The Trip-Ease-Ium mark.
 *
 * A trapezium holding a landscape: sun, mountains, a dashed route winding up
 * to a location pin, trees on the near slope. The whole trip, contained inside
 * the shape — which is the brand's one idea, and the reason the name is a pun
 * on "trapezium".
 *
 * Authored as inline SVG rather than shipped as a raster so it stays crisp at
 * every size, inherits brand colours from tokens, and can animate its route
 * line. `title` is optional: the mark is usually decorative because a wordmark
 * sits beside it, and announcing "Trip-Ease-Ium logo" twice is noise for a
 * screen reader.
 */
export function TrapeziumMark({
  size = 40,
  animated = false,
  title,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; animated?: boolean; title?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      width={size}
      height={size * (100 / 120)}
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title && <title>{title}</title>}

      {/* The trapezium, and the clip that keeps the landscape inside it. */}
      <defs>
        <clipPath id="tei-mark-clip">
          <path d="M32 14 H88 L108 84 H12 Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#tei-mark-clip)">
        {/* Ground first, edge to edge, so no corner of the frame is left
            showing the page behind it. */}
        <rect x="0" y="0" width="120" height="100" fill="var(--surface)" />

        {/* Sun */}
        <circle cx="50" cy="36" r="10.5" fill="var(--peach)" />

        {/* Far mountains, seated on the frame's bottom edge. */}
        <path d="M-4 88 L34 36 L52 60 L62 49 L88 88 Z" fill="var(--sage)" />
        <path d="M34 36 L42.5 47.5 L25.5 47.5 Z" fill="#ffffff" opacity="0.92" />

        {/* Near slope, carried past both edges so the base is solid. */}
        <path
          d="M-4 88 C22 71 46 79 66 70 C86 61 102 66 124 61 L124 96 H-4 Z"
          fill="var(--sage-deep)"
        />

        {/* Trees on the near slope */}
        <g fill="var(--forest)">
          <path d="M86 64 l5.5 9.5 h-11 Z M86 58 l4.5 8.5 h-9 Z" />
          <rect x="85" y="72" width="2" height="7" />
          <path d="M98 68 l5.5 9.5 h-11 Z M98 62 l4.5 8.5 h-9 Z" />
          <rect x="97" y="76" width="2" height="7" />
        </g>

        {/* The winding route — the journey through the frame. Fine and clearly
            dashed, so it reads as a trail rather than a drawn line. */}
        <path
          d="M26 79 C42 77 40 65 53 59 C67 52 69 39 84 31"
          stroke="var(--forest)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeDasharray="3 4.5"
          fill="none"
          className={animated ? 'animate-draw' : undefined}
          style={animated ? ({ '--dash': '120' } as React.CSSProperties) : undefined}
        />
      </g>

      {/* Trapezium outline, over the scene so it reads as a frame. */}
      <path
        d="M32 14 H88 L108 84 H12 Z"
        stroke="var(--forest)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Destination pin — the one terracotta moment, and the only element
          that sits outside the frame, exactly as in the logo. */}
      <g className={animated ? 'animate-pin' : undefined}>
        <path
          d="M90 1 c-6.1 0-11 4.9-11 11 0 8.2 11 19.6 11 19.6 s11-11.4 11-19.6 c0-6.1-4.9-11-11-11 Z"
          fill="var(--terracotta)"
        />
        <circle cx="90" cy="12" r="4.1" fill="var(--surface)" />
      </g>
    </svg>
  );
}

/**
 * The wordmark.
 *
 * "Ease" carries the sage colour, exactly as the logo does — the middle of the
 * word is the middle of the promise, and it is also the half that makes the
 * trapezium pun audible.
 *
 * The final syllable is set as "ium", not "Ium": in a high-contrast serif the
 * capital I is an unadorned vertical stem, so "Ium" reads as "lum" and the
 * wordplay dies on the page.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`text-forest font-serif font-bold tracking-tight whitespace-nowrap ${className}`}
    >
      Trip-<span className="text-sage-deep">Ease</span>-ium
    </span>
  );
}

/** Mark plus wordmark, the standard lockup for headers and footers. */
export function Logo({
  size = 34,
  className = '',
  wordmarkClassName = 'text-xl',
  animated = false,
}: {
  size?: number;
  className?: string;
  wordmarkClassName?: string;
  animated?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <TrapeziumMark size={size} animated={animated} />
      <Wordmark className={wordmarkClassName} />
    </span>
  );
}
