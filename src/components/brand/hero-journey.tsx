'use client';

import { useEffect, useRef, useState } from 'react';

interface AbstractMilestone {
  id: string;
  step: string;
  title: string;
  detail: string;
  xPercent: number; // 0 to 100%
  yPercent: number; // 0 to 100%
}

const PAGE_MILESTONES: AbstractMilestone[] = [
  {
    id: 'outbound',
    step: '01',
    title: 'Departure & Route',
    detail: 'Timetables & transit matched',
    xPercent: 78,
    yPercent: 12,
  },
  {
    id: 'stays',
    step: '02',
    title: 'Curated Stays',
    detail: 'Nightly pace & rest buffers',
    xPercent: 22,
    yPercent: 32,
  },
  {
    id: 'places',
    step: '03',
    title: 'Sights & Dining',
    detail: 'Geographic clusters & hours',
    xPercent: 78,
    yPercent: 53,
  },
  {
    id: 'budget',
    step: '04',
    title: 'Budget Reconciled',
    detail: 'Every total verified',
    xPercent: 24,
    yPercent: 75,
  },
  {
    id: 'arrival',
    step: '05',
    title: 'Arrival Ready',
    detail: 'Complete journey in hand',
    xPercent: 50,
    yPercent: 95,
  },
];

export function FullPageJourneyPath() {
  const pathRef = useRef<SVGPathElement>(null);
  const currentProgressRef = useRef(0.05);
  const [pinPos, setPinPos] = useState<{ xPercent: number; yPercent: number }>({
    xPercent: 18,
    yPercent: 3,
  });

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    let animationFrameId: number;
    let totalLength = 1000;
    try {
      totalLength = path.getTotalLength();
    } catch {
      // Fallback
    }

    const updatePin = () => {
      if (typeof window === 'undefined') return;

      const doc = document.documentElement;
      const scrollY = window.scrollY || doc.scrollTop || 0;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const scrollRatio = Math.min(Math.max(scrollY / maxScroll, 0), 1);

      // Map scrollRatio (0 to 1) along the path progress (0.02 to 0.98)
      const targetProgress = 0.02 + scrollRatio * 0.96;

      // Smooth lerp interpolation for a silky glide
      currentProgressRef.current += (targetProgress - currentProgressRef.current) * 0.12;

      try {
        const pt = path.getPointAtLength(currentProgressRef.current * totalLength);
        // viewBox is 0 0 1000 1000, so pt.x / 10 is percentage (0-100)
        setPinPos({
          xPercent: pt.x / 10,
          yPercent: pt.y / 10,
        });
      } catch {
        // SVG measurement fallback
      }

      animationFrameId = requestAnimationFrame(updatePin);
    };

    animationFrameId = requestAnimationFrame(updatePin);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
    >
      {/* Soft atmospheric ambient color washes down the page */}
      <div className="clip-trapezium bg-sage-soft/30 absolute -top-24 -left-32 h-[600px] w-[700px] -rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/35 absolute top-1/4 -right-36 h-[700px] w-[750px] rotate-12 blur-3xl" />
      <div className="clip-trapezium bg-sage-soft/25 absolute top-1/2 -left-36 h-[700px] w-[700px] rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/25 absolute top-3/4 -right-32 h-[650px] w-[700px] -rotate-6 blur-3xl" />

      {/* SVG Canvas for the Vertical Journey Path */}
      <svg
        className="absolute inset-0 h-full w-full opacity-60"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="verticalRouteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--forest)" stopOpacity="0.75" />
            <stop offset="25%" stopColor="var(--sage)" stopOpacity="0.85" />
            <stop offset="65%" stopColor="var(--sage-deep)" stopOpacity="0.9" />
            <stop offset="90%" stopColor="var(--terracotta)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--terracotta)" stopOpacity="1" />
          </linearGradient>

          <filter id="beaconGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="5"
              floodColor="var(--terracotta)"
              floodOpacity="0.5"
            />
          </filter>
        </defs>

        {/* Faint Topographical Elevation Contours Along the Route */}
        <g opacity="0.25" stroke="var(--sage)" strokeWidth="1" fill="none">
          <path d="M-100,120 Q400,90 1100,180" strokeDasharray="6 8" />
          <path d="M-100,340 Q600,380 1100,300" strokeDasharray="4 6" />
          <path d="M-100,560 Q350,520 1100,590" strokeDasharray="5 7" />
          <path d="M-100,770 Q650,810 1100,730" strokeDasharray="4 6" />
        </g>

        {/* Inactive Dashed Base Path */}
        <path
          d="M 180,30 C 360,50 720,60 780,140 C 840,220 320,240 200,330 C 120,410 760,440 800,540 C 840,630 300,670 220,760 C 160,840 680,870 500,955"
          stroke="var(--line-strong)"
          strokeWidth="2.5"
          strokeDasharray="5 7"
          fill="none"
          opacity="0.45"
        />

        {/* Primary Radiant Route Path */}
        <path
          ref={pathRef}
          d="M 180,30 C 360,50 720,60 780,140 C 840,220 320,240 200,330 C 120,410 760,440 800,540 C 840,630 300,670 220,760 C 160,840 680,870 500,955"
          stroke="url(#verticalRouteGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      </svg>

      {/* Abstract Plan Milestones Positioned Down the Vertical Route */}
      {PAGE_MILESTONES.map((m) => (
        <div
          key={m.id}
          style={{ left: `${m.xPercent}%`, top: `${m.yPercent}%` }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-10"
        >
          <div className="flex items-center gap-2 rounded-full border border-line-strong/60 bg-surface/85 px-3 py-1 shadow-xs backdrop-blur-xs opacity-75">
            <span className="size-2 rounded-full bg-forest opacity-80" />
            <span className="font-serif text-[11px] font-bold text-forest whitespace-nowrap">
              {m.title}
            </span>
            <span className="hidden sm:inline font-mono text-[9px] text-ink-muted whitespace-nowrap">
              · {m.detail}
            </span>
          </div>
        </div>
      ))}

      {/* Moving Terracotta Location Beacon / Pin */}
      <div
        style={{
          left: `${pinPos.xPercent}%`,
          top: `${pinPos.yPercent}%`,
        }}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-[85%] z-20 transition-transform duration-75"
      >
        <div className="flex flex-col items-center">
          {/* Active Plan Tag */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest px-2.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-cream uppercase shadow-md backdrop-blur-xs whitespace-nowrap">
            <span className="size-1.5 rounded-full bg-terracotta animate-pulse" />
            Active Plan
          </span>

          {/* Location Pin SVG */}
          <svg
            viewBox="0 0 24 32"
            width="26"
            height="34"
            className="drop-shadow-[0_4px_10px_rgba(217,111,80,0.5)] mt-0.5"
          >
            <path
              d="M12 0 C5.37 0 0 5.37 0 12 C0 21 12 32 12 32 C12 32 24 21 24 12 C24 5.37 18.63 0 12 0 Z"
              fill="var(--terracotta)"
            />
            <circle cx="12" cy="11" r="5" fill="var(--surface)" />
            <circle cx="12" cy="11" r="2.5" fill="var(--forest)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Aliases for compatibility
export { FullPageJourneyPath as HeroJourney, FullPageJourneyPath as HeroJourneyBackground };
