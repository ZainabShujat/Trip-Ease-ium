'use client';

import { useEffect, useRef, useState, type SVGProps } from 'react';

/**
 * ScrollAssembledMark
 *
 * An interactive, scroll-assembled version of the Trip-Ease-Ium mark for the final CTA section.
 *
 * As the visitor scrolls into the closing CTA section:
 * 1. The trapezium frame draws itself into place via strokeDashoffset.
 * 2. The mountains and slope rise seamlessly from the base.
 * 3. The sun and trees assemble organically.
 * 4. The inner winding trail draws toward the location pin.
 * 5. As the global route marker reaches the logo, the location pin completes the reveal.
 *
 * When scrolling back up, each element reverses naturally back into the journey line.
 */
export function ScrollAssembledMark({
  size = 72,
  className = '',
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // Start assembly when CTA logo approaches the lower third of the viewport (vh * 0.95)
      // Fully assemble when the logo is centered at comfortable eye level (vh * 0.45)
      const enterY = vh * 0.92;
      const targetY = vh * 0.42;
      const raw = (enterY - rect.top) / (enterY - targetY);
      const clamped = Math.min(Math.max(raw, 0), 1);
      setProgress(clamped);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Map progress (0 to 1) to individual organic stage progresses:
  // Phase 1: Frame drawing (0.05 -> 0.50)
  const frameP = Math.min(Math.max((progress - 0.05) / 0.45, 0), 1);
  // Phase 2: Landscape mountains & ground fill (0.25 -> 0.70)
  const groundP = Math.min(Math.max((progress - 0.25) / 0.45, 0), 1);
  // Phase 3: Sun, trees & inner winding route (0.45 -> 0.85)
  const detailsP = Math.min(Math.max((progress - 0.45) / 0.40, 0), 1);
  // Phase 4: Pin destination docking completion (0.70 -> 1.0)
  const pinP = Math.min(Math.max((progress - 0.70) / 0.30, 0), 1);

  // Perimeter of the trapezium path M32 14 H88 L108 84 H12 Z is ~265
  const frameLength = 265;
  const frameOffset = frameLength * (1 - frameP);

  // Length of the inner winding route line M26 79 ... is ~85
  const routeLength = 85;
  const routeOffset = routeLength * (1 - detailsP);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center transition-transform duration-300 ${className}`}
      style={{
        width: size,
        height: size * (100 / 120),
        transform: `scale(${0.92 + progress * 0.08})`,
        opacity: Math.min(Math.max(progress * 1.5, 0.15), 1),
      }}
    >
      <svg
        viewBox="0 0 120 100"
        width={size}
        height={size * (100 / 120)}
        fill="none"
        role="presentation"
        aria-hidden="true"
        {...props}
      >
        <defs>
          <clipPath id="tei-scroll-mark-clip">
            <path d="M32 14 H88 L108 84 H12 Z" />
          </clipPath>
        </defs>

        <g clipPath="url(#tei-scroll-mark-clip)">
          {/* Base ground fill — emerges as the frame draws */}
          <rect
            x="0"
            y="0"
            width="120"
            height="100"
            fill="var(--surface)"
            style={{
              opacity: groundP,
              transition: 'opacity 0.2s ease-out',
            }}
          />

          {/* Sun — rises smoothly from behind the mountains */}
          <g
            style={{
              transform: `translateY(${(1 - detailsP) * 14}px)`,
              opacity: detailsP,
              transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
            }}
          >
            <circle cx="50" cy="36" r="10.5" fill="var(--peach)" />
          </g>

          {/* Far mountains — rises from base */}
          <g
            style={{
              transform: `translateY(${(1 - groundP) * 20}px)`,
              opacity: groundP,
              transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
            }}
          >
            <path d="M-4 88 L34 36 L52 60 L62 49 L88 88 Z" fill="var(--sage)" />
            <path d="M34 36 L42.5 47.5 L25.5 47.5 Z" fill="#ffffff" opacity="0.92" />
          </g>

          {/* Near slope — carried past both edges */}
          <g
            style={{
              transform: `translateY(${(1 - groundP) * 12}px)`,
              opacity: groundP,
              transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
            }}
          >
            <path
              d="M-4 88 C22 71 46 79 66 70 C86 61 102 66 124 61 L124 96 H-4 Z"
              fill="var(--sage-deep)"
            />
          </g>

          {/* Trees on the near slope — emerges with details */}
          <g
            fill="var(--forest)"
            style={{
              opacity: detailsP,
              transform: `scale(${0.8 + detailsP * 0.2})`,
              transformOrigin: '90px 70px',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            }}
          >
            <path d="M86 64 l5.5 9.5 h-11 Z M86 58 l4.5 8.5 h-9 Z" />
            <rect x="85" y="72" width="2" height="7" />
            <path d="M98 68 l5.5 9.5 h-11 Z M98 62 l4.5 8.5 h-9 Z" />
            <rect x="97" y="76" width="2" height="7" />
          </g>

          {/* The winding route inside the logo — progressively drawn by the journey */}
          <path
            d="M26 79 C42 77 40 65 53 59 C67 52 69 39 84 31"
            stroke="var(--forest)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="3 4.5"
            strokeDashoffset={routeOffset}
            fill="none"
            style={{
              opacity: Math.min(detailsP * 1.4, 1),
            }}
          />
        </g>

        {/* Trapezium outline — drawn smoothly around the scene as the route approaches */}
        <path
          d="M32 14 H88 L108 84 H12 Z"
          stroke="var(--forest)"
          strokeWidth="4.5"
          strokeLinejoin="round"
          strokeDasharray={frameLength}
          strokeDashoffset={frameOffset}
          fill="none"
          style={{
            transition: 'stroke-dashoffset 0.1s linear',
          }}
        />

        {/* Destination pin — the terracotta waypoint completed as the route marker docks */}
        <g
          style={{
            opacity: pinP,
            transform: `translateY(${(1 - pinP) * 8}px) scale(${0.7 + pinP * 0.3})`,
            transformOrigin: '90px 20px',
            transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
          }}
        >
          <path
            d="M90 1 c-6.1 0-11 4.9-11 11 0 8.2 11 19.6 11 19.6 s11-11.4 11-19.6 c0-6.1-4.9-11-11-11 Z"
            fill="var(--terracotta)"
          />
          <circle cx="90" cy="12" r="4.1" fill="var(--surface)" />
        </g>
      </svg>
    </div>
  );
}
