'use client';

import { useEffect, useRef, useState } from 'react';

interface AbstractMilestone {
  id: string;
  step: string;
  title: string;
  xPercent: number; // 0 to 100%
  yPercent: number; // 0 to 100%
}

const PAGE_MILESTONES: AbstractMilestone[] = [
  {
    id: 'outbound',
    step: '01',
    title: 'Departure & Route',
    xPercent: 62,
    yPercent: 7,
  },
  {
    id: 'stays',
    step: '02',
    title: 'Curated Stays',
    xPercent: 28,
    yPercent: 26,
  },
  {
    id: 'places',
    step: '03',
    title: 'Sights & Dining',
    xPercent: 74,
    yPercent: 44,
  },
  {
    id: 'budget',
    step: '04',
    title: 'Budget & Schedule',
    xPercent: 26,
    yPercent: 65,
  },
  {
    id: 'arrival',
    step: '05',
    title: 'Destination Ready',
    xPercent: 50,
    yPercent: 94,
  },
];

export function FullPageJourneyPath() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [bubblePos, setBubblePos] = useState<{ xPercent: number; yPercent: number }>({
    xPercent: 65,
    yPercent: 6,
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

    if (samples.length === 0) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const containerHeight = rect.height || 1;

      // Target position in viewport: keep bubble in comfortable view around 38% from top of screen
      const viewportTargetY = window.innerHeight * 0.38;

      // Position relative to container
      const relativeY = viewportTargetY - rect.top;

      // Normalized ratio (0 to 1) clamped safely
      const targetRatio = Math.min(Math.max(relativeY / containerHeight, 0.02), 0.98);
      const targetYInViewBox = targetRatio * 1000; // viewBox is 1000x1000

      const firstSample = samples[0];
      if (!firstSample) return;

      // Find the closest point in Y along the sampled curve
      let closest = firstSample;
      let minDiff = Math.abs(firstSample.y - targetYInViewBox);
      for (let i = 1; i < samples.length; i++) {
        const sample = samples[i];
        if (!sample) continue;
        const diff = Math.abs(sample.y - targetYInViewBox);
        if (diff < minDiff) {
          minDiff = diff;
          closest = sample;
        }
      }

      setBubblePos({
        xPercent: closest.x / 10,
        yPercent: closest.y / 10,
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
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
    >
      {/* Delicate, faint atmospheric tint washes */}
      <div className="clip-trapezium bg-sage-soft/18 absolute -top-24 -left-32 h-[500px] w-[600px] -rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/20 absolute top-1/4 -right-36 h-[600px] w-[650px] rotate-12 blur-3xl" />
      <div className="clip-trapezium bg-sage-soft/15 absolute top-1/2 -left-36 h-[600px] w-[600px] rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/15 absolute top-3/4 -right-32 h-[550px] w-[600px] -rotate-6 blur-3xl" />

      {/* SVG Canvas with thinner, fader journey line */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="thinVerticalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--forest)" stopOpacity="0.3" />
            <stop offset="25%" stopColor="var(--sage)" stopOpacity="0.35" />
            <stop offset="60%" stopColor="var(--sage-deep)" stopOpacity="0.35" />
            <stop offset="85%" stopColor="var(--terracotta)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--terracotta)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Very faint elevation contour lines */}
        <g opacity="0.12" stroke="var(--sage)" strokeWidth="0.8" fill="none">
          <path d="M-50,110 Q400,80 1050,160" strokeDasharray="4 8" />
          <path d="M-50,330 Q600,360 1050,290" strokeDasharray="3 7" />
          <path d="M-50,550 Q350,510 1050,570" strokeDasharray="4 8" />
          <path d="M-50,760 Q650,790 1050,720" strokeDasharray="3 7" />
        </g>

        {/* Faint Dashed Guide Line */}
        <path
          d="M 650,40 C 450,90 250,130 280,200 C 300,270 750,310 760,390 C 770,470 220,510 220,590 C 220,670 780,710 750,790 C 730,870 530,910 500,965"
          stroke="var(--line-strong)"
          strokeWidth="1"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.2"
        />

        {/* Thin, Faded Continuous Route Path */}
        <path
          ref={pathRef}
          d="M 650,40 C 450,90 250,130 280,200 C 300,270 750,310 760,390 C 770,470 220,510 220,590 C 220,670 780,710 750,790 C 730,870 530,910 500,965"
          stroke="url(#thinVerticalGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Faded Abstract Plan Milestones */}
      {PAGE_MILESTONES.map((m) => (
        <div
          key={m.id}
          style={{ left: `${m.xPercent}%`, top: `${m.yPercent}%` }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-10"
        >
          <div className="flex items-center gap-1.5 rounded-full border border-line/40 bg-surface/50 px-2.5 py-0.5 backdrop-blur-xs opacity-40">
            <span className="size-1 rounded-full bg-forest/60" />
            <span className="font-serif text-[10px] font-medium text-forest/80 whitespace-nowrap">
              {m.title}
            </span>
          </div>
        </div>
      ))}

      {/* Thinner, Fader Location Bubble Tracking Scroll Realtime */}
      <div
        style={{
          left: `${bubblePos.xPercent}%`,
          top: `${bubblePos.yPercent}%`,
        }}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20"
      >
        <div className="flex flex-col items-center gap-0.5">
          {/* Subtle translucent pill tag */}
          <span className="inline-flex items-center gap-1 rounded-full border border-terracotta/25 bg-surface/75 px-2 py-0.5 text-[8.5px] font-mono font-medium tracking-wider text-terracotta/80 uppercase shadow-xs backdrop-blur-xs whitespace-nowrap opacity-85">
            <span className="size-1 rounded-full bg-terracotta animate-pulse" />
            Route
          </span>

          {/* Delicate Mini Location Indicator */}
          <div className="relative flex size-5 items-center justify-center">
            {/* Faint pulsing wave */}
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-terracotta/20" />
            {/* Subtle outer halo */}
            <span className="relative flex size-3.5 items-center justify-center rounded-full border border-terracotta/50 bg-surface/90 shadow-xs">
              <span className="size-1.5 rounded-full bg-terracotta" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aliases for compatibility
export { FullPageJourneyPath as HeroJourney, FullPageJourneyPath as HeroJourneyBackground };
