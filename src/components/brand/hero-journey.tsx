'use client';

import { useEffect, useRef, useState } from 'react';

export function FullPageJourneyPath() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const lastScrollYRef = useRef(0);
  const scrollDirRef = useRef<'down' | 'up'>('down');
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const currentAngleRef = useRef(180);

  const [arrowPos, setArrowPos] = useState<{
    xPercent: number;
    yPercent: number;
    angle: number;
    progress: number;
  }>({
    xPercent: 51,
    yPercent: 2,
    angle: 180, // Facing downwards initially
    progress: 0,
  });

  useEffect(() => {
    const path = pathRef.current;
    const container = containerRef.current;
    if (!path || !container) return;

    let rafId: number | null = null;
    let totalLength = 1000;
    try {
      totalLength = path.getTotalLength();
    } catch {
      // Fallback
    }

    const updateFrame = () => {
      // Slow, smooth, luxurious lerp damping
      const dist = targetProgressRef.current - currentProgressRef.current;
      if (Math.abs(dist) > 0.0001) {
        currentProgressRef.current += dist * 0.055;
      } else {
        currentProgressRef.current = targetProgressRef.current;
      }

      const progress = currentProgressRef.current;
      const targetLength = progress * totalLength;

      try {
        const pt = path.getPointAtLength(targetLength);
        const delta = 4;
        const pStart = path.getPointAtLength(Math.max(targetLength - delta, 0));
        const pEnd = path.getPointAtLength(Math.min(targetLength + delta, totalLength));

        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width || 1;
        const containerHeight = rect.height || 1;

        const pixelDx = ((pEnd.x - pStart.x) / 1000) * containerWidth;
        const pixelDy = ((pEnd.y - pStart.y) / 1000) * containerHeight;

        // Tangent parallel to the path:
        // Downstream (down): pointing along forward travel (+pixelDx, +pixelDy)
        // Upstream (up): pointing along backward travel (-pixelDx, -pixelDy)
        // Arrow SVG points North (up) at 0deg. atan2(dy, dx) + 90 rotates tip parallel to vector (dx, dy).
        const tangentDown = Math.atan2(pixelDy, pixelDx) * (180 / Math.PI) + 90;
        const tangentUp = Math.atan2(-pixelDy, -pixelDx) * (180 / Math.PI) + 90;

        const desiredAngle = scrollDirRef.current === 'down' ? tangentDown : tangentUp;

        // Shortest-path continuous angle unwrapping to prevent 360-degree spin flips
        let diff = (desiredAngle - currentAngleRef.current) % 360;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        currentAngleRef.current += diff;

        const xPercent = pt.x / 10;
        const yPercent = pt.y / 10;

        setArrowPos({
          xPercent,
          yPercent,
          angle: currentAngleRef.current,
          progress,
        });

        // Broadcast current viewport Y of arrow for title alignment glow
        const arrowViewportY = rect.top + (yPercent / 100) * containerHeight;
        (window as unknown as { __TEI_ARROW_VIEWPORT_Y__?: number }).__TEI_ARROW_VIEWPORT_Y__ = arrowViewportY;
        window.dispatchEvent(new CustomEvent('tei-arrow-scroll', { detail: { viewportY: arrowViewportY } }));
      } catch {
        // Fallback
      }

      rafId = requestAnimationFrame(updateFrame);
    };

    const handleScroll = () => {
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

      targetProgressRef.current = Math.min(Math.max(scrollY / maxScroll, 0), 1);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();
    rafId = requestAnimationFrame(updateFrame);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
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
            <stop offset="0%" stopColor="#17382a" stopOpacity="0.25" />
            <stop offset="25%" stopColor="#2e6b54" stopOpacity="0.30" />
            <stop offset="55%" stopColor="#b45309" stopOpacity="0.40" />
            <stop offset="85%" stopColor="#d97706" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Faint Dashed Under-Guide (0.85px, 10% opacity) */}
        <path
          d="M 510,20 C 720,50 860,95 830,155 C 800,210 520,225 320,240 C 140,255 130,310 220,345 C 310,380 680,385 760,420 C 840,455 830,510 680,545 C 530,580 270,595 190,635 C 110,675 140,715 280,735 C 440,755 820,775 860,820 C 900,865 750,885 610,910 C 450,932 340,944 420,947 C 450,948 475,948 490,948"
          stroke="var(--line-strong)"
          strokeWidth="0.85"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.10"
        />

        {/* Curvy, organic, random adventure route line - strictly monotonic downward Y, ends at y=948 above footer */}
        <path
          ref={pathRef}
          d="M 510,20 C 720,50 860,95 830,155 C 800,210 520,225 320,240 C 140,255 130,310 220,345 C 310,380 680,385 760,420 C 840,455 830,510 680,545 C 530,580 270,595 190,635 C 110,675 140,715 280,735 C 440,755 820,775 860,820 C 900,865 750,885 610,910 C 450,932 340,944 420,947 C 450,948 475,948 490,948"
          stroke="url(#superLightJourneyGrad)"
          strokeWidth="1.15"
          strokeLinecap="round"
          fill="none"
          className="drop-shadow-[0_0_3px_rgba(217,119,6,0.20)]"
        />
      </svg>

      {/* Directional arrow with smooth rotation and slow gliding motion */}
      <div
        style={{
          left: `${arrowPos.xPercent}%`,
          top: `${arrowPos.yPercent}%`,
          transform: `translate(-50%, -50%) rotate(${arrowPos.angle}deg)`,
          opacity: arrowPos.progress >= 0.86 ? Math.max(1 - (arrowPos.progress - 0.86) / 0.05, 0) : 1,
        }}
        className="pointer-events-none absolute z-40 transition-transform duration-200 ease-out"
      >
        <div className="relative flex size-9 sm:size-10 items-center justify-center">
          {/* Warm golden outer pulsating halo wave */}
          <span className="absolute inline-flex size-full rounded-full bg-[#F59E0B]/25 animate-ping duration-1000" />

          {/* Radiant golden halo aura */}
          <span className="absolute inline-flex size-8 sm:size-9 rounded-full bg-[#D97706]/20 blur-[3px]" />

          {/* High-visibility Warm Golden Beacon Body */}
          <div className="relative flex size-6 sm:size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#F59E0B] via-[#D97706] to-[#92400E] border-2 border-white shadow-[0_0_12px_rgba(245,158,11,0.65),0_0_24px_rgba(217,119,6,0.35),0_2px_6px_rgba(0,0,0,0.3)] text-white">
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
