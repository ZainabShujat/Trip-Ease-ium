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
  }>({
    xPercent: 52,
    yPercent: 2,
    angle: 180, // Facing downwards initially
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
      // Subtle, smooth lerp damping for cartographic trail marker
      const dist = targetProgressRef.current - currentProgressRef.current;
      if (Math.abs(dist) > 0.0001) {
        currentProgressRef.current += dist * 0.06;
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
      className="pointer-events-none absolute inset-0 z-20 select-none"
    >
      {/* Whisper-soft ambient background gradients */}
      <div className="clip-trapezium bg-sage-soft/10 absolute -top-24 -left-32 h-[500px] w-[600px] -rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/12 absolute top-1/4 -right-36 h-[600px] w-[650px] rotate-12 blur-3xl" />
      <div className="clip-trapezium bg-sage-soft/8 absolute top-1/2 -left-36 h-[600px] w-[600px] rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/8 absolute top-3/4 -right-32 h-[550px] w-[600px] -rotate-6 blur-3xl" />

      {/* SVG Canvas for the refined, lightweight travel-map route */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="travelMapRouteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#17382a" stopOpacity="0.20" />
            <stop offset="25%" stopColor="#2e6b54" stopOpacity="0.25" />
            <stop offset="55%" stopColor="#b45309" stopOpacity="0.30" />
            <stop offset="85%" stopColor="#d97706" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.40" />
          </linearGradient>
        </defs>

        {/* Faint Dashed Travel-Trail Under-Guide (0.75px, subtle cartographic track) */}
        <path
          d="M 520,20 C 680,30 820,50 820,90 C 820,130 750,175 660,195 C 570,215 440,215 320,225 C 240,232 160,245 110,270 C 85,290 80,315 110,332 C 170,336 270,338 380,340 C 490,340 600,342 715,344 C 820,348 915,360 925,395 C 935,430 890,460 810,475 C 730,490 600,495 480,505 C 340,518 180,530 120,555 C 90,570 110,588 180,595 C 270,600 380,600 480,600 C 580,600 680,600 780,600 C 865,600 930,612 930,635 C 930,648 830,644 650,644 C 450,644 240,644 140,660 C 110,670 115,685 160,690 C 240,692 330,692 410,692 C 500,692 570,692 630,692 C 710,692 780,692 835,695 C 880,725 890,770 850,810 C 800,845 680,865 570,880 C 460,895 400,915 430,935 C 450,945 475,948 490,948"
          stroke="var(--line-strong)"
          strokeWidth="0.75"
          strokeDasharray="2 5"
          fill="none"
          opacity="0.08"
        />

        {/* Intentional Travel-Map Route: flows through whitespace, connects stages 1->2->3->4->5->6->7, concludes above footer */}
        <path
          ref={pathRef}
          d="M 520,20 C 680,30 820,50 820,90 C 820,130 750,175 660,195 C 570,215 440,215 320,225 C 240,232 160,245 110,270 C 85,290 80,315 110,332 C 170,336 270,338 380,340 C 490,340 600,342 715,344 C 820,348 915,360 925,395 C 935,430 890,460 810,475 C 730,490 600,495 480,505 C 340,518 180,530 120,555 C 90,570 110,588 180,595 C 270,600 380,600 480,600 C 580,600 680,600 780,600 C 865,600 930,612 930,635 C 930,648 830,644 650,644 C 450,644 240,644 140,660 C 110,670 115,685 160,690 C 240,692 330,692 410,692 C 500,692 570,692 630,692 C 710,692 780,692 835,695 C 880,725 890,770 850,810 C 800,845 680,865 570,880 C 460,895 400,915 430,935 C 450,945 475,948 490,948"
          stroke="url(#travelMapRouteGrad)"
          strokeWidth="0.95"
          strokeLinecap="round"
          fill="none"
          className="drop-shadow-[0_0_2px_rgba(217,119,6,0.15)]"
        />
      </svg>

      {/* Directional Travel-Map Route Marker: visually attached, clearly directional, subtle scroll progression */}
      <div
        style={{
          left: `${arrowPos.xPercent}%`,
          top: `${arrowPos.yPercent}%`,
          transform: `translate(-50%, -50%) rotate(${arrowPos.angle}deg)`,
        }}
        className="pointer-events-none absolute z-30 transition-transform duration-150 ease-out"
      >
        <div className="relative flex size-7 sm:size-8 items-center justify-center">
          {/* Subtle warm ambient cartographic halo */}
          <span className="absolute inline-flex size-full rounded-full bg-[#D97706]/15 blur-[2px]" />

          {/* Precision Travel-Map Waypoint Pin */}
          <div className="relative flex size-5 sm:size-6 items-center justify-center rounded-full bg-surface border-[1.5px] border-[#D97706] shadow-[0_1px_4px_rgba(0,0,0,0.12),0_0_6px_rgba(217,119,6,0.3)] text-[#B45309]">
            <svg viewBox="0 0 16 16" width="9" height="9" fill="currentColor" className="drop-shadow-xs">
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
