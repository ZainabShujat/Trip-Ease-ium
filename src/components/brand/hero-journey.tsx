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
    xPercent: 51,
    yPercent: 1.5,
    angle: 125,
  });

  useEffect(() => {
    const path = pathRef.current;
    const container = containerRef.current;
    if (!path || !container) return;

    const handleScroll = () => {
      let totalLength = 1000;
      try {
        totalLength = path.getTotalLength();
      } catch {
        // Fallback
      }

      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const maxScroll = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );

      // Exactly 0 at top-most scroll (top corner of line), exactly 1 at bottom-most scroll (bottom corner of line)
      const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      const targetLength = progress * totalLength;

      try {
        const pt = path.getPointAtLength(targetLength);
        const delta = 2;
        const ptPrev = path.getPointAtLength(Math.max(targetLength - delta, 0));
        const ptNext = path.getPointAtLength(Math.min(targetLength + delta, totalLength));

        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width || 1;
        const containerHeight = rect.height || 1;

        const pixelDx = ((ptNext.x - ptPrev.x) / 1000) * containerWidth;
        const pixelDy = ((ptNext.y - ptPrev.y) / 1000) * containerHeight;
        const angleDeg = Math.atan2(pixelDy, pixelDx) * (180 / Math.PI) - 90;

        const xPercent = pt.x / 10;
        const yPercent = pt.y / 10;

        setArrowPos({
          xPercent,
          yPercent,
          angle: angleDeg,
        });

        // Broadcast current viewport Y of arrow for title alignment glow
        const arrowViewportY = rect.top + (yPercent / 100) * containerHeight;
        (window as unknown as { __TEI_ARROW_VIEWPORT_Y__?: number }).__TEI_ARROW_VIEWPORT_Y__ = arrowViewportY;
        window.dispatchEvent(new CustomEvent('tei-arrow-scroll', { detail: { viewportY: arrowViewportY } }));
      } catch {
        // Fallback
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
            <stop offset="0%" stopColor="#17382a" stopOpacity="0.30" />
            <stop offset="25%" stopColor="#2e6b54" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#ff5722" stopOpacity="0.45" />
            <stop offset="85%" stopColor="#ff3d00" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff9100" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        {/* Faint Dashed Under-Guide (0.85px, 10% opacity) */}
        <path
          d="M 510,15 C 730,45 870,85 820,150 C 760,220 460,185 300,215 C 140,245 130,310 230,345 C 340,380 670,320 750,385 C 830,445 820,495 670,525 C 520,555 260,535 180,590 C 100,645 140,700 280,715 C 450,735 830,685 870,765 C 910,845 740,865 600,890 C 440,915 280,940 370,970 C 450,995 540,1000 500,1015"
          stroke="var(--line-strong)"
          strokeWidth="0.85"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.10"
        />

        {/* Curvy, organic, random adventure route line with subtle neon glow */}
        <path
          ref={pathRef}
          d="M 510,15 C 730,45 870,85 820,150 C 760,220 460,185 300,215 C 140,245 130,310 230,345 C 340,380 670,320 750,385 C 830,445 820,495 670,525 C 520,555 260,535 180,590 C 100,645 140,700 280,715 C 450,735 830,685 870,765 C 910,845 740,865 600,890 C 440,915 280,940 370,970 C 450,995 540,1000 500,1015"
          stroke="url(#superLightJourneyGrad)"
          strokeWidth="1.15"
          strokeLinecap="round"
          fill="none"
          className="drop-shadow-[0_0_3px_rgba(255,87,34,0.22)]"
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
        <div className="relative flex size-9 sm:size-10 items-center justify-center">
          {/* Luminous outer pulsating neon halo wave */}
          <span className="absolute inline-flex size-full rounded-full bg-[#FF3D00]/45 animate-ping duration-1000" />

          {/* Radiant neon halo aura */}
          <span className="absolute inline-flex size-8 sm:size-9 rounded-full bg-[#FF5722]/35 blur-[3px]" />

          {/* High-visibility Neon Beacon Body */}
          <div className="relative flex size-6 sm:size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FF1744] via-[#FF5252] to-[#FF9100] border-2 border-white shadow-[0_0_14px_#FF3D00,0_0_28px_rgba(255,23,68,0.7),0_2px_6px_rgba(0,0,0,0.35)] text-white">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <path d="M8 1.5 L14 13.5 L8 10.5 L2 13.5 Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aliases for compatibility
export { FullPageJourneyPath as HeroJourney, FullPageJourneyPath as HeroJourneyBackground };
