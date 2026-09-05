'use client';

import { useEffect, useRef, useState } from 'react';
import { CompassIcon, PlacesIcon, StayIcon, TransportIcon } from './icons';

interface AbstractMilestone {
  id: string;
  step: string;
  title: string;
  detail: string;
  x: number; // coordinate in viewBox (1200x520)
  y: number;
  icon: React.ReactNode;
}

const PLAN_MILESTONES: AbstractMilestone[] = [
  {
    id: 'outbound',
    step: '01',
    title: 'Departure & Route',
    detail: 'Timetables & transit matched',
    x: 140,
    y: 410,
    icon: <TransportIcon size={14} />,
  },
  {
    id: 'stays',
    step: '02',
    title: 'Curated Stays',
    detail: 'Nightly pace & rest buffers',
    x: 460,
    y: 310,
    icon: <StayIcon size={14} />,
  },
  {
    id: 'places',
    step: '03',
    title: 'Sights & Dining',
    detail: 'Geographic clusters & hours',
    x: 770,
    y: 330,
    icon: <PlacesIcon size={14} />,
  },
  {
    id: 'arrival',
    step: '04',
    title: 'Unified Itinerary',
    detail: 'Budget reconciled to zero',
    x: 1060,
    y: 150,
    icon: <CompassIcon size={14} />,
  },
];

export function HeroJourneyBackground() {
  const pathRef = useRef<SVGPathElement>(null);
  const [pinCoord, setPinCoord] = useState<{ x: number; y: number }>({ x: 140, y: 410 });

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const totalLength = path.getTotalLength();
    let animationFrameId: number;
    let startTime: number | null = null;

    const updatePin = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      // Scroll progression: moves pin forward as user scrolls
      const scrollProgress = typeof window !== 'undefined'
        ? Math.min(Math.max(window.scrollY / 450, 0), 1)
        : 0;

      // Continuous gentle ambient breathing cycle across the journey
      const ambientCycle = (Math.sin(elapsed * 0.35) + 1) / 2; // oscillates 0 to 1 over ~18s

      // Blend ambient movement with scroll progress
      const targetProgress = Math.min(Math.max(ambientCycle * 0.35 + scrollProgress * 0.65, 0.04), 0.96);

      try {
        const point = path.getPointAtLength(targetProgress * totalLength);
        setPinCoord({ x: point.x, y: point.y });
      } catch {
        // Fallback if SVG measurement is not yet ready
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
      {/* Soft ambient atmospheric color gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-cream/20 via-transparent to-surface/80" />
      <div className="clip-trapezium bg-sage-soft/35 absolute -top-24 -left-20 h-[480px] w-[600px] -rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/40 absolute -right-24 top-1/4 h-[440px] w-[580px] rotate-12 blur-3xl" />

      {/* SVG Canvas for topography, contour lines, and the journey route */}
      <svg
        className="absolute inset-0 h-full w-full opacity-60 transition-opacity duration-700"
        viewBox="0 0 1200 520"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="routeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--forest)" stopOpacity="0.8" />
            <stop offset="40%" stopColor="var(--sage)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--terracotta)" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="contourGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--sage-deep)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--forest)" stopOpacity="0.03" />
          </linearGradient>

          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="4"
              floodColor="var(--terracotta)"
              floodOpacity="0.45"
            />
          </filter>
        </defs>

        {/* Faded background mountain silhouettes */}
        <g opacity="0.45">
          <polygon points="0,520 180,310 360,520" fill="url(#contourGrad)" />
          <polygon points="260,520 480,240 700,520" fill="url(#contourGrad)" />
          <polygon points="610,520 840,190 1070,520" fill="url(#contourGrad)" />
          <polygon points="950,520 1100,280 1200,520" fill="url(#contourGrad)" />
        </g>

        {/* Faded topographic elevation contour lines */}
        <g opacity="0.35" stroke="var(--sage)" strokeWidth="1" fill="none">
          <path d="M-50,470 Q280,510 580,440 T1250,380" strokeDasharray="6 8" />
          <path d="M-50,410 Q320,430 680,360 T1250,290" strokeDasharray="3 5" />
          <path d="M-50,340 Q400,320 800,270 T1250,210" strokeDasharray="4 7" />
        </g>

        {/* Inactive Dashed Base Route */}
        <path
          d="M 60,430 C 240,460 380,280 620,320 S 920,240 1140,140"
          stroke="var(--line-strong)"
          strokeWidth="2.5"
          strokeDasharray="4 6"
          fill="none"
          opacity="0.5"
        />

        {/* Primary Glowing Active Journey Path */}
        <path
          ref={pathRef}
          d="M 60,430 C 240,460 380,280 620,320 S 920,240 1140,140"
          stroke="url(#routeGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />

        {/* Abstract Milestones (Plan Nodes) */}
        {PLAN_MILESTONES.map((m) => (
          <g key={m.id} transform={`translate(${m.x}, ${m.y})`}>
            {/* Outer soft aura */}
            <circle r="22" fill="var(--surface)" opacity="0.8" />
            <circle
              r="15"
              fill="var(--surface)"
              stroke="var(--forest)"
              strokeWidth="1.5"
              strokeOpacity="0.4"
            />
            <circle r="4" fill="var(--forest)" opacity="0.7" />

            {/* Subtle Milestone Info Pill */}
            <g transform="translate(0, 30)">
              <rect
                x="-75"
                y="-10"
                width="150"
                height="34"
                rx="6"
                fill="var(--surface)"
                stroke="var(--line)"
                strokeWidth="1"
                opacity="0.9"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                fill="var(--forest)"
                fontSize="11"
                fontFamily="serif"
                fontWeight="700"
              >
                {m.title}
              </text>
              <text
                x="0"
                y="16"
                textAnchor="middle"
                fill="var(--ink-muted)"
                fontSize="9"
                fontFamily="sans-serif"
              >
                {m.detail}
              </text>
            </g>
          </g>
        ))}

        {/* Traveling Pin / Beacon */}
        <g
          transform={`translate(${pinCoord.x}, ${pinCoord.y})`}
          filter="url(#softGlow)"
          className="transition-transform duration-75"
        >
          {/* Pulsing Beacon Rings */}
          <circle r="24" fill="var(--terracotta)" opacity="0.2" className="animate-ping" />
          <circle r="12" fill="var(--terracotta)" opacity="0.3" />

          {/* Terracotta Pin Graphic */}
          <g transform="translate(-12, -28)">
            <svg viewBox="0 0 24 32" width="24" height="32">
              <path
                d="M12 0 C5.37 0 0 5.37 0 12 C0 21 12 32 12 32 C12 32 24 21 24 12 C24 5.37 18.63 0 12 0 Z"
                fill="var(--terracotta)"
              />
              <circle cx="12" cy="11" r="5" fill="var(--surface)" />
              <circle cx="12" cy="11" r="2.5" fill="var(--forest)" />
            </svg>
          </g>

          {/* Floating 'Active Plan' Pill above the pin */}
          <g transform="translate(0, -38)">
            <rect
              x="-42"
              y="-10"
              width="84"
              height="18"
              rx="9"
              fill="var(--forest)"
              opacity="0.95"
            />
            <circle cx="-28" cy="-1" r="2.5" fill="var(--terracotta)" />
            <text
              x="-20"
              y="2.5"
              fill="var(--cream)"
              fontSize="8.5"
              fontFamily="sans-serif"
              fontWeight="600"
              letterSpacing="0.4"
            >
              ACTIVE PLAN
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

// Re-export as HeroJourney for backwards compatibility if needed
export { HeroJourneyBackground as HeroJourney };
