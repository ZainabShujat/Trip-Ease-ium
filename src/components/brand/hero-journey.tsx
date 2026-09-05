'use client';

import { useEffect, useRef, useState } from 'react';

export function FullPageJourneyPath() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const lastScrollYRef = useRef(0);
  const scrollDirRef = useRef<'down' | 'up'>('down');
  const currentAngleRef = useRef(180);

  const [arrowPos, setArrowPos] = useState<{
    xPercent: number;
    yPercent: number;
    angle: number;
  }>({
    xPercent: 51,
    yPercent: 2,
    angle: 180, // Facing downwards initially
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
      const scrollDelta = scrollY - lastScrollYRef.current;
      if (scrollDelta > 0.5) {
        scrollDirRef.current = 'down';
      } else if (scrollDelta < -0.5) {
        scrollDirRef.current = 'up';
      }
      lastScrollYRef.current = scrollY;

      const maxScroll = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );

      // Exactly 0 at top-most scroll, exactly 1 at bottom-most scroll
      const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      const targetLength = progress * totalLength;

      try {
        const pt = path.getPointAtLength(targetLength);
        const delta = 5;

        let pStart: DOMPoint;
        let pEnd: DOMPoint;

        if (scrollDirRef.current === 'down') {
          // Pointing downstream in the direction of downward travel
          pStart = path.getPointAtLength(Math.max(targetLength - delta, 0));
          pEnd = path.getPointAtLength(Math.min(targetLength + delta, totalLength));
        } else {
          // Scrolling up: reverse tangent vector so arrow points upstream/upward in direction of travel
          pStart = path.getPointAtLength(Math.min(targetLength + delta, totalLength));
          pEnd = path.getPointAtLength(Math.max(targetLength - delta, 0));
        }

        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width || 1;
        const containerHeight = rect.height || 1;

        const pixelDx = ((pEnd.x - pStart.x) / 1000) * containerWidth;
        const pixelDy = ((pEnd.y - pStart.y) / 1000) * containerHeight;

        // Arrow icon tip is at top (north) in SVG viewBox at 0deg
        // Tangent along vector (pixelDx, pixelDy) is: atan2(pixelDy, pixelDx) + 90
        const rawAngle = Math.atan2(pixelDy, pixelDx) * (180 / Math.PI) + 90;

        // Shortest-path continuous angle interpolation to prevent 360-degree spin flips
        let diff = (rawAngle - currentAngleRef.current) % 360;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        const newAngle = currentAngleRef.current + diff;
        currentAngleRef.current = newAngle;

        const xPercent = pt.x / 10;
        const yPercent = pt.y / 10;

        setArrowPos({
          xPercent,
          yPercent,
          angle: newAngle,
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
      className="pointer-events-none absolute inset-0 z-30 select-none"
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
          d="M 510,20 C 730,50 870,90 820,155 C 760,225 460,190 300,220 C 140,250 130,315 230,350 C 340,385 670,325 750,390 C 830,450 820,500 670,530 C 520,560 260,540 180,595 C 100,650 140,705 280,720 C 450,740 830,690 870,770 C 910,850 740,870 600,895 C 440,915 310,935 380,945 C 420,952 460,952 485,948"
          stroke="var(--line-strong)"
          strokeWidth="0.85"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.10"
        />

        {/* Curvy, organic, random adventure route line - ends safely above footer at y=948 */}
        <path
          ref={pathRef}
          d="M 510,20 C 730,50 870,90 820,155 C 760,225 460,190 300,220 C 140,250 130,315 230,350 C 340,385 670,325 750,390 C 830,450 820,500 670,530 C 520,560 260,540 180,595 C 100,650 140,705 280,720 C 450,740 830,690 870,770 C 910,850 740,870 600,895 C 440,915 310,935 380,945 C 420,952 460,952 485,948"
          stroke="url(#superLightJourneyGrad)"
          strokeWidth="1.15"
          strokeLinecap="round"
          fill="none"
          className="drop-shadow-[0_0_3px_rgba(255,87,34,0.22)]"
        />
      </svg>

      {/* Directional arrow with smooth rotation and position transitions */}
      <div
        style={{
          left: `${arrowPos.xPercent}%`,
          top: `${arrowPos.yPercent}%`,
          transform: `translate(-50%, -50%) rotate(${arrowPos.angle}deg)`,
        }}
        className="pointer-events-none absolute z-40 transition-transform duration-200 ease-out"
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
