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
      className="pointer-events-none absolute inset-0 z-30 select-none overflow-hidden"
    >
      {/* Whisper-soft ambient background gradients */}
      <div className="clip-trapezium bg-sage-soft/10 absolute -top-24 -left-32 h-[500px] w-[600px] -rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/12 absolute top-1/4 -right-36 h-[600px] w-[650px] rotate-12 blur-3xl" />
      <div className="clip-trapezium bg-sage-soft/8 absolute top-1/2 -left-36 h-[600px] w-[600px] rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/8 absolute top-3/4 -right-32 h-[550px] w-[600px] -rotate-6 blur-3xl" />

      {/* SVG Canvas for the super-light, thin translucent journey line overlapping all content */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="superLightJourneyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--forest)" stopOpacity="0.16" />
            <stop offset="30%" stopColor="var(--sage)" stopOpacity="0.18" />
            <stop offset="65%" stopColor="var(--sage-deep)" stopOpacity="0.20" />
            <stop offset="90%" stopColor="var(--terracotta)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--terracotta)" stopOpacity="0.28" />
          </linearGradient>
        </defs>

        {/* Faint Dashed Under-Guide (0.75px, 8% opacity) */}
        <path
          d="M 650,40 C 450,90 250,130 280,200 C 300,270 750,310 760,390 C 770,470 220,510 220,590 C 220,670 780,710 750,790 C 730,870 530,910 500,965"
          stroke="var(--line-strong)"
          strokeWidth="0.75"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.08"
        />

        {/* Super Light & Thin Route Line (0.85px) overlapping all cards and homepage content */}
        <path
          ref={pathRef}
          d="M 650,40 C 450,90 250,130 280,200 C 300,270 750,310 760,390 C 770,470 220,510 220,590 C 220,670 780,710 750,790 C 730,870 530,910 500,965"
          stroke="url(#superLightJourneyGrad)"
          strokeWidth="0.85"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Directional arrow locked at vertical midpoint (50vh) of viewport */}
      <div
        style={{
          left: `${arrowPos.xPercent}%`,
          top: `${arrowPos.yPercent}%`,
          transform: `translate(-50%, -50%) rotate(${arrowPos.angle}deg)`,
        }}
        className="pointer-events-none absolute z-40 transition-transform duration-75"
      >
        <div className="relative flex size-5 items-center justify-center">
          {/* Subtle pulse halo */}
          <span className="absolute inline-flex size-full rounded-full bg-terracotta/12 animate-ping" />
          
          {/* Minimalist arrow dot */}
          <div className="relative flex size-4 items-center justify-center rounded-full border border-terracotta/40 bg-surface/95 shadow-xs text-terracotta">
            <svg viewBox="0 0 16 16" width="8" height="8" fill="currentColor">
              <path d="M8 2 L13 13 L8 10.5 L3 13 Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aliases for compatibility
export { FullPageJourneyPath as HeroJourney, FullPageJourneyPath as HeroJourneyBackground };
