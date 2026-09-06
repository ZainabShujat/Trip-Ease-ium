'use client';

import { useEffect, useRef, useState, type SVGProps } from 'react';

/**
 * ScrollAssembledMark
 *
 * A grand, interactive centerpiece of the Trip-Ease-Ium logo for the closing CTA section.
 *
 * Re-forms the brand logo in real time as the journey arrow from the top of the page arrives:
 * 1. The same golden beacon arrow traces the bold outer trapezium frame.
 * 2. The mountains, slopes, and golden sun emerge within the drawn silhouette.
 * 3. The arrow swoops into the landscape, drawing the inner winding route.
 * 4. The arrow docks at the destination waypoint, completing the terracotta location pin.
 * 5. Scrolling back up reverses the animation naturally, with the arrow un-drawing the logo.
 */
export function ScrollAssembledMark({
  size = 280,
  className = '',
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const framePathRef = useRef<SVGPathElement>(null);
  const routePathRef = useRef<SVGPathElement>(null);

  const [progress, setProgress] = useState(0);
  const [arrowState, setArrowState] = useState<{
    x: number;
    y: number;
    angle: number;
    visible: boolean;
    scale: number;
  }>({
    x: 32,
    y: 14,
    angle: 90,
    visible: false,
    scale: 1,
  });

  useEffect(() => {
    const framePath = framePathRef.current;
    const routePath = routePathRef.current;

    let frameLen = 265;
    let routeLen = 85;

    try {
      if (framePath) frameLen = framePath.getTotalLength();
      if (routePath) routeLen = routePath.getTotalLength();
    } catch {
      // Default fallback lengths
    }

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // Start drawing as the CTA logo approaches from the lower viewport
      // Complete as it centers in view
      const enterY = vh * 0.94;
      const targetY = vh * 0.40;
      const raw = (enterY - rect.top) / (enterY - targetY);
      const clamped = Math.min(Math.max(raw, 0), 1);
      setProgress(clamped);

      // Compute exact position and tangent orientation for the drawing arrow
      if (clamped < 0.02) {
        setArrowState({
          x: 32,
          y: 14,
          angle: 90,
          visible: false,
          scale: 0.8,
        });
      } else if (clamped <= 0.54) {
        // Phase 1: Arrow physically draws the outer trapezium frame
        const frameP = (clamped - 0.02) / 0.52;
        const targetDistance = Math.min(frameP * frameLen, frameLen);
        try {
          if (framePath) {
            const pt = framePath.getPointAtLength(targetDistance);
            const delta = 2;
            const pAhead = framePath.getPointAtLength(Math.min(targetDistance + delta, frameLen));
            const pBehind = framePath.getPointAtLength(Math.max(targetDistance - delta, 0));
            const angle = Math.atan2(pAhead.y - pBehind.y, pAhead.x - pBehind.x) * (180 / Math.PI) + 90;
            setArrowState({
              x: pt.x,
              y: pt.y,
              angle,
              visible: true,
              scale: 1,
            });
          }
        } catch {
          // Fallback
        }
      } else if (clamped <= 0.88) {
        // Phase 2: Arrow swoops into the scene and draws the inner winding route
        const routeP = (clamped - 0.54) / 0.34;
        const targetDistance = Math.min(routeP * routeLen, routeLen);
        try {
          if (routePath) {
            const pt = routePath.getPointAtLength(targetDistance);
            const delta = 2;
            const pAhead = routePath.getPointAtLength(Math.min(targetDistance + delta, routeLen));
            const pBehind = routePath.getPointAtLength(Math.max(targetDistance - delta, 0));
            const angle = Math.atan2(pAhead.y - pBehind.y, pAhead.x - pBehind.x) * (180 / Math.PI) + 90;
            setArrowState({
              x: pt.x,
              y: pt.y,
              angle,
              visible: true,
              scale: 0.95,
            });
          }
        } catch {
          // Fallback
        }
      } else {
        // Phase 3: Arrow arrives at the destination pin (90, 12)
        const dockP = (clamped - 0.88) / 0.12;
        const startX = 84;
        const startY = 31;
        const endX = 90;
        const endY = 12;
        const currX = startX + (endX - startX) * dockP;
        const currY = startY + (endY - startY) * dockP;

        setArrowState({
          x: currX,
          y: currY,
          angle: 0,
          visible: dockP < 0.95,
          scale: Math.max(1 - dockP * 0.45, 0.55),
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Proportional phase progress for SVG elements
  const frameP = Math.min(Math.max((progress - 0.02) / 0.52, 0), 1);
  const groundP = Math.min(Math.max((progress - 0.28) / 0.40, 0), 1);
  const detailsP = Math.min(Math.max((progress - 0.48) / 0.38, 0), 1);
  const pinP = Math.min(Math.max((progress - 0.84) / 0.16, 0), 1);

  const frameLength = 265;
  const frameOffset = frameLength * (1 - frameP);

  const routeLength = 85;
  const routeOffset = routeLength * (1 - detailsP);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center select-none transition-transform duration-200 ${className}`}
      style={{
        width: size,
        height: size * (100 / 120),
        transform: `scale(${0.96 + progress * 0.04})`,
      }}
    >
      <svg
        viewBox="0 0 120 100"
        width="100%"
        height="100%"
        fill="none"
        role="presentation"
        aria-hidden="true"
        className="overflow-visible"
        {...props}
      >
        <defs>
          <clipPath id="tei-big-mark-clip">
            <path d="M32 14 H88 L108 84 H12 Z" />
          </clipPath>

          <linearGradient id="teiArrowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>

          <filter id="tei-beacon-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.4" />
          </filter>

          <filter id="tei-arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        <g clipPath="url(#tei-big-mark-clip)">
          {/* Base ground fill emerges as frame is drawn */}
          <rect
            x="0"
            y="0"
            width="120"
            height="100"
            fill="var(--surface)"
            style={{
              opacity: groundP,
              transition: 'opacity 0.25s ease-out',
            }}
          />

          {/* Golden Sun rising from the horizon */}
          <g
            style={{
              transform: `translateY(${(1 - detailsP) * 16}px)`,
              opacity: detailsP,
              transition: 'transform 0.25s ease-out, opacity 0.25s ease-out',
            }}
          >
            <circle cx="50" cy="36" r="10.5" fill="var(--peach)" />
          </g>

          {/* Far Sage Mountains rising from the base */}
          <g
            style={{
              transform: `translateY(${(1 - groundP) * 22}px)`,
              opacity: groundP,
              transition: 'transform 0.25s ease-out, opacity 0.25s ease-out',
            }}
          >
            <path d="M-4 88 L34 36 L52 60 L62 49 L88 88 Z" fill="var(--sage)" />
            <path d="M34 36 L42.5 47.5 L25.5 47.5 Z" fill="#ffffff" opacity="0.92" />
          </g>

          {/* Near Slope rolling across the foreground */}
          <g
            style={{
              transform: `translateY(${(1 - groundP) * 14}px)`,
              opacity: groundP,
              transition: 'transform 0.25s ease-out, opacity 0.25s ease-out',
            }}
          >
            <path
              d="M-4 88 C22 71 46 79 66 70 C86 61 102 66 124 61 L124 96 H-4 Z"
              fill="var(--sage-deep)"
            />
          </g>

          {/* Forest Trees standing on the near slope */}
          <g
            fill="var(--forest)"
            style={{
              opacity: detailsP,
              transform: `scale(${0.75 + detailsP * 0.25})`,
              transformOrigin: '90px 70px',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            }}
          >
            <path d="M86 64 l5.5 9.5 h-11 Z M86 58 l4.5 8.5 h-9 Z" />
            <rect x="85" y="72" width="2" height="7" />
            <path d="M98 68 l5.5 9.5 h-11 Z M98 62 l4.5 8.5 h-9 Z" />
            <rect x="97" y="76" width="2" height="7" />
          </g>

          {/* The winding trail drawn out by the arrow */}
          <path
            ref={routePathRef}
            d="M26 79 C42 77 40 65 53 59 C67 52 69 39 84 31"
            stroke="var(--forest)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="3 4.5"
            strokeDashoffset={routeOffset}
            fill="none"
            style={{
              opacity: Math.min(detailsP * 1.5, 1),
            }}
          />
        </g>

        {/* Outer Trapezium Frame drawn out by the arrow */}
        <path
          ref={framePathRef}
          d="M32 14 H88 L108 84 H12 Z"
          stroke="var(--forest)"
          strokeWidth="4.5"
          strokeLinejoin="round"
          strokeDasharray={frameLength}
          strokeDashoffset={frameOffset}
          fill="none"
        />

        {/* Destination Pin blooming into place */}
        <g
          style={{
            opacity: pinP,
            transform: `translateY(${(1 - pinP) * 10}px) scale(${0.6 + pinP * 0.4})`,
            transformOrigin: '90px 20px',
            transition: 'transform 0.25s ease-out, opacity 0.25s ease-out',
          }}
        >
          <path
            d="M90 1 c-6.1 0-11 4.9-11 11 0 8.2 11 19.6 11 19.6 s11-11.4 11-19.6 c0-6.1-4.9-11-11-11 Z"
            fill="var(--terracotta)"
          />
          <circle cx="90" cy="12" r="4.1" fill="var(--surface)" />
        </g>

        {/* THE DRAWING ARROW: Exactly matches the journey arrow from the top of the page */}
        {arrowState.visible && (
          <g
            transform={`translate(${arrowState.x}, ${arrowState.y}) rotate(${arrowState.angle}) scale(${arrowState.scale})`}
            className="pointer-events-none"
          >
            {/* Warm golden outer pulsating halo wave */}
            <circle cx="0" cy="0" r="10" fill="#F59E0B" opacity="0.25" className="animate-ping" />

            {/* Radiant golden halo aura */}
            <circle cx="0" cy="0" r="8" fill="#D97706" opacity="0.3" filter="url(#tei-arrow-glow)" />

            {/* High-visibility Warm Golden Beacon Body matching the top journey arrow */}
            <circle cx="0" cy="0" r="5.5" fill="url(#teiArrowGrad)" stroke="#FFFFFF" strokeWidth="1.2" filter="url(#tei-beacon-shadow)" />

            {/* Precision white direction triangle */}
            <g transform="scale(0.55) translate(-8, -8)">
              <path
                d="M8 1.5 L14 13.5 L8 10.5 L2 13.5 Z"
                fill="#FFFFFF"
                className="drop-shadow-xs"
              />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
