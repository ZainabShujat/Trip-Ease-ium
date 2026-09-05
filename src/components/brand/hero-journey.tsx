'use client';

import { useEffect, useState } from 'react';
import {
  BudgetIcon,
  CheckIcon,
  CompassIcon,
  PlacesIcon,
  StayIcon,
  TransportIcon,
} from './icons';

interface Milestone {
  id: string;
  label: string;
  title: string;
  meta: string;
  icon: React.ReactNode;
  x: number; // percentage in svg
  y: number;
}

const MILESTONES: Milestone[] = [
  {
    id: 'origin',
    label: 'Departure',
    title: 'New Delhi',
    meta: '06:00 AM · Volvo Sleeper',
    icon: <TransportIcon size={14} />,
    x: 12,
    y: 78,
  },
  {
    id: 'transit',
    label: 'Scenic Vista',
    title: 'Kullu Valley',
    meta: '1,278m · 45m photo stop',
    icon: <PlacesIcon size={14} />,
    x: 42,
    y: 54,
  },
  {
    id: 'stay',
    label: 'Curated Stay',
    title: 'Riverside Cottage',
    meta: '₹2,900/nt · Near sights',
    icon: <StayIcon size={14} />,
    x: 68,
    y: 38,
  },
  {
    id: 'destination',
    label: 'Arrival',
    title: 'Old Manali',
    meta: 'Day-by-day plan ready',
    icon: <CompassIcon size={14} />,
    x: 90,
    y: 20,
  },
];

export function HeroJourney() {
  const [activePoint, setActivePoint] = useState<string>('destination');
  const [pinProgress, setPinProgress] = useState(0.85);

  // Smooth ambient animation or scroll-influenced progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Map 0 - 300px scroll to moving along 0.2 -> 1.0 progress
      const factor = Math.min(Math.max((scrollY / 350), 0), 1);
      setPinProgress(0.25 + factor * 0.7);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Compute location pin position along a cubic bezier curve:
  // Path starts at (12%, 78%) -> P1 (28%, 68%) -> P2 (55%, 45%) -> End (90%, 20%)
  const t = pinProgress;
  // Cubic Bezier interpolation: B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
  const p0 = { x: 12, y: 78 };
  const p1 = { x: 34, y: 72 };
  const p2 = { x: 60, y: 46 };
  const p3 = { x: 90, y: 20 };

  const pinX =
    Math.pow(1 - t, 3) * p0.x +
    3 * Math.pow(1 - t, 2) * t * p1.x +
    3 * (1 - t) * Math.pow(t, 2) * p2.x +
    Math.pow(t, 3) * p3.x;

  const pinY =
    Math.pow(1 - t, 3) * p0.y +
    3 * Math.pow(1 - t, 2) * t * p1.y +
    3 * (1 - t) * Math.pow(t, 2) * p2.y +
    Math.pow(t, 3) * p3.y;

  return (
    <div className="relative w-full max-w-xl select-none">
      {/* Decorative ambient atmospheric glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-sage-soft/70 via-peach-soft/50 to-transparent blur-2xl"
      />

      {/* Main Glass Visual Canvas */}
      <div className="relative overflow-hidden rounded-2xl border border-line-strong/60 bg-surface/85 p-5 shadow-[var(--shadow-lg)] backdrop-blur-md sm:p-7">
        {/* Top interactive status bar */}
        <div className="flex items-center justify-between border-b border-line/70 pb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-terracotta" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-wider text-forest uppercase">
              Live Route · Delhi &rarr; Manali
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok-soft/70 px-2.5 py-0.5 font-mono text-[11px] font-medium text-ok">
            <CheckIcon size={12} />
            All 4 dimensions synced
          </span>
        </div>

        {/* Scenic map area */}
        <div className="relative my-4 h-[240px] w-full sm:h-[270px]">
          {/* Subtle stylized topographical / mountain backdrop */}
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.22]"
            viewBox="0 0 400 240"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Background Mountains */}
            <polygon points="0,240 60,130 140,240" fill="var(--sage-deep)" />
            <polygon points="90,240 190,90 280,240" fill="var(--forest)" />
            <polygon points="210,240 310,110 390,240" fill="var(--sage)" />
            <polygon points="320,240 370,140 400,240" fill="var(--sage-deep)" />
            {/* Soft river / elevation contour line */}
            <path
              d="M0,210 Q120,225 210,180 T400,160"
              stroke="var(--sage)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 6"
            />
          </svg>

          {/* SVG Animated Route Line */}
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--forest)" />
                <stop offset="50%" stopColor="var(--sage)" />
                <stop offset="100%" stopColor="var(--terracotta)" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="var(--terracotta)" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Inactive Route Base */}
            <path
              d="M 12 78 C 34 72, 60 46, 90 20"
              stroke="var(--line-strong)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="2 3"
            />

            {/* Glowing Active Route Curve */}
            <path
              d="M 12 78 C 34 72, 60 46, 90 20"
              stroke="url(#routeGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              className="animate-draw"
              style={{ '--dash': 160 } as React.CSSProperties}
            />
          </svg>

          {/* Interactive Milestone Nodes */}
          {MILESTONES.map((m) => {
            const isSelected = activePoint === m.id;
            return (
              <div
                key={m.id}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                onClick={() => {
                  setActivePoint(m.id);
                  setPinProgress(m.x / 100);
                }}
                className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              >
                {/* Milestone Node */}
                <div
                  className={`flex size-7 items-center justify-center rounded-full border transition-all duration-300 ${
                    isSelected
                      ? 'scale-110 border-terracotta bg-surface text-terracotta shadow-[0_0_12px_rgba(217,111,80,0.35)]'
                      : 'border-forest/30 bg-cream text-forest hover:scale-105 hover:border-forest'
                  }`}
                >
                  {m.icon}
                </div>

                {/* Floating Tooltip Pill */}
                <div
                  className={`pointer-events-none absolute left-1/2 mt-1.5 -translate-x-1/2 rounded-md border px-2 py-1 text-center whitespace-nowrap shadow-sm transition-all duration-200 ${
                    isSelected
                      ? 'border-forest/20 bg-surface opacity-100'
                      : 'border-line bg-surface/90 opacity-75 group-hover:opacity-100'
                  }`}
                >
                  <p className="font-serif text-xs font-bold text-forest">{m.title}</p>
                  <p className="font-mono text-[10px] text-ink-muted">{m.meta}</p>
                </div>
              </div>
            );
          })}

          {/* Dynamic Traveling Pin / Beacon */}
          <div
            style={{
              left: `${pinX}%`,
              top: `${pinY}%`,
              transition: 'left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
          >
            <div className="flex flex-col items-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-forest px-2 py-0.5 text-[10px] font-medium tracking-tight text-cream shadow-md">
                <span className="size-1.5 rounded-full bg-terracotta animate-pulse" />
                Active Plan
              </span>
              {/* Pin SVG */}
              <svg
                viewBox="0 0 24 32"
                width="24"
                height="32"
                className="drop-shadow-[0_4px_6px_rgba(217,111,80,0.4)]"
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

        {/* Floating Mini Metric Cards at bottom */}
        <div className="grid grid-cols-2 gap-3 border-t border-line/60 pt-3.5 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface/80 p-2.5">
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <BudgetIcon size={12} className="text-sage-deep" />
              Budget tracked
            </span>
            <span className="font-serif text-sm font-bold text-forest">₹38,200</span>
            <span className="text-[10px] text-ok font-medium">₹1,800 under limit</span>
          </div>

          <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface/80 p-2.5">
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <TransportIcon size={12} className="text-sage-deep" />
              Travel buffer
            </span>
            <span className="font-serif text-sm font-bold text-forest">5 Nights / 6 Days</span>
            <span className="text-[10px] text-ink-soft">Zero overlaps</span>
          </div>

          <div className="col-span-2 flex flex-col gap-0.5 rounded-lg border border-line bg-surface/80 p-2.5 sm:col-span-1">
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <PlacesIcon size={12} className="text-sage-deep" />
              Spots shortlisted
            </span>
            <span className="font-serif text-sm font-bold text-forest">14 Activities</span>
            <span className="text-[10px] text-sage-deep">Grouped by area</span>
          </div>
        </div>
      </div>
    </div>
  );
}
