'use client';

import { useEffect, useRef, useState } from 'react';

export function FullPageJourneyPath() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [arrowPos, setArrowPos] = useState<{
    xPercent: number;
    yPercent: number;
    angle: number;
  }>({
    xPercent: 55,
    yPercent: 8,
    angle: 155,
  });

  useEffect(() => {
    const path = pathRef.current;
    const container = containerRef.current;
    if (!path || !container) return;

    let totalLength = 1000;
    try {
      totalLength = path.getTotalLength();
    } catch {
      // Fallback
    }

    // Pre-sample points along the monotonic curve for instant, accurate scroll tracking
    const SAMPLES_COUNT = 300;
    const samples: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= SAMPLES_COUNT; i++) {
      const len = (i / SAMPLES_COUNT) * totalLength;
      try {
        const pt = path.getPointAtLength(len);
        samples.push({ x: pt.x, y: pt.y });
      } catch {
        // Fallback
      }
    }

    const firstSample = samples[0];
    if (!firstSample) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const containerHeight = rect.height || 1;

      // Exact mid-screen vertically: 50% of viewport height (equal distance from top and bottom)
      const viewportMidY = window.innerHeight * 0.5;

      // Vertical position relative to the container
      const relativeY = viewportMidY - rect.top;

      // Clamped normalized ratio along the container
      const targetRatio = Math.min(Math.max(relativeY / containerHeight, 0.02), 0.98);
      const targetYInViewBox = targetRatio * 1000; // viewBox is 1000x1000

      // Find the closest point in Y along the sampled curve
      let closestIndex = 0;
      let minDiff = Math.abs(firstSample.y - targetYInViewBox);
      for (let i = 1; i < samples.length; i++) {
        const sample = samples[i];
        if (!sample) continue;
        const diff = Math.abs(sample.y - targetYInViewBox);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      const closest = samples[closestIndex] ?? firstSample;

      // Compute tangent angle along the route so the arrow points in the direction of travel
      const prev = samples[Math.max(closestIndex - 2, 0)] ?? closest;
      const next = samples[Math.min(closestIndex + 2, samples.length - 1)] ?? closest;
      const containerWidth = rect.width || 1;
      const pixelDx = ((next.x - prev.x) / 1000) * containerWidth;
      const pixelDy = ((next.y - prev.y) / 1000) * containerHeight;

      // Arrow path points upwards (0deg = up), so angle = atan2(pixelDy, pixelDx) in degrees - 90
      const angleDeg = Math.atan2(pixelDy, pixelDx) * (180 / Math.PI) - 90;

      setArrowPos({
        xPercent: closest.x / 10,
        yPercent: closest.y / 10,
        angle: angleDeg,
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 select-none overflow-hidden"
    >
      {/* Soft atmospheric gradient touches */}
      <div className="clip-trapezium bg-sage-soft/15 absolute -top-24 -left-32 h-[500px] w-[600px] -rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/18 absolute top-1/4 -right-36 h-[600px] w-[650px] rotate-12 blur-3xl" />
      <div className="clip-trapezium bg-sage-soft/12 absolute top-1/2 -left-36 h-[600px] w-[600px] rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/12 absolute top-3/4 -right-32 h-[550px] w-[600px] -rotate-6 blur-3xl" />

      {/* SVG Canvas for the translucent journey line overlapping homepage content */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="translucentJourneyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--forest)" stopOpacity="0.32" />
            <stop offset="30%" stopColor="var(--sage)" stopOpacity="0.36" />
            <stop offset="65%" stopColor="var(--sage-deep)" stopOpacity="0.38" />
            <stop offset="90%" stopColor="var(--terracotta)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--terracotta)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Faint Dashed Under-Guide */}
        <path
          d="M 650,40 C 450,90 250,130 280,200 C 300,270 750,310 760,390 C 770,470 220,510 220,590 C 220,670 780,710 750,790 C 730,870 530,910 500,965"
          stroke="var(--line-strong)"
          strokeWidth="1"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.18"
        />

        {/* Translucent Fine Route Line overlapping page content */}
        <path
          ref={pathRef}
          d="M 650,40 C 450,90 250,130 280,200 C 300,270 750,310 760,390 C 770,470 220,510 220,590 C 220,670 780,710 750,790 C 730,870 530,910 500,965"
          stroke="url(#translucentJourneyGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Sleek directional arrow locked at exact vertical midpoint (50vh) of the viewport */}
      <div
        style={{
          left: `${arrowPos.xPercent}%`,
          top: `${arrowPos.yPercent}%`,
          transform: `translate(-50%, -50%) rotate(${arrowPos.angle}deg)`,
        }}
        className="pointer-events-none absolute z-30 transition-transform duration-75"
      >
        <div className="relative flex size-6 items-center justify-center">
          {/* Faint ambient pulse halo */}
          <span className="absolute inline-flex size-full rounded-full bg-terracotta/15 animate-ping" />
          
          {/* Sleek minimalist arrow badge */}
          <div className="relative flex size-5 items-center justify-center rounded-full border border-terracotta/50 bg-surface/90 shadow-sm backdrop-blur-xs text-terracotta">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
              <path d="M8 1.5 L13.5 13.5 L8 10.5 L2.5 13.5 Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aliases for compatibility
export { FullPageJourneyPath as HeroJourney, FullPageJourneyPath as HeroJourneyBackground };
