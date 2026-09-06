'use client';

import { useEffect, useRef, useState } from 'react';

const JOURNEY_PATH_D =
  'M 510,20 C 720,50 860,95 830,155 C 800,210 520,225 320,240 C 140,255 130,310 220,345 C 310,380 680,385 760,420 C 840,455 830,510 680,545 C 530,580 270,595 190,635 C 110,675 140,715 280,735 C 440,755 820,775 860,820 C 890,845 780,865 620,875 C 460,885 360,895 375,912 C 385,925 400,935 415,920 C 418,910 419,903 420,902 H 580 L 620 958 H 380 L 420 902 C 435,922 460,948 490,944 C 520,940 540,924 565,916 C 578,910 582,898 584,886';

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

  // Proportional reveal stages for the logo as the line curls up in the CTA section
  const groundOpacity = Math.min(Math.max((arrowPos.progress - 0.78) / 0.12, 0), 1);
  const sunOpacity = Math.min(Math.max((arrowPos.progress - 0.81) / 0.12, 0), 1);
  const mountainOpacity = Math.min(Math.max((arrowPos.progress - 0.84) / 0.10, 0), 1);
  const pinOpacity = Math.min(Math.max((arrowPos.progress - 0.94) / 0.06, 0), 1);

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

      {/* SVG Canvas spanning the entire page */}
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="superLightJourneyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#17382a" stopOpacity="0.30" />
            <stop offset="25%" stopColor="#2e6b54" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#b45309" stopOpacity="0.45" />
            <stop offset="78%" stopColor="#d97706" stopOpacity="0.65" />
            <stop offset="90%" stopColor="#f59e0b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.95" />
          </linearGradient>

          {/* Clip path for the logo's inner landscape */}
          <clipPath id="ctaJourneyLogoClip">
            <path d="M 420 902 H 580 L 620 958 H 380 Z" />
          </clipPath>
        </defs>

        {/* LOGO ARTWORK: Slowly revealed inside the curl as the line forms the logo in the CTA section */}
        <g clipPath="url(#ctaJourneyLogoClip)">
          {/* Surface fill */}
          <rect
            x="360"
            y="890"
            width="280"
            height="80"
            fill="var(--surface)"
            style={{
              opacity: groundOpacity,
              transition: 'opacity 0.2s ease-out',
            }}
          />

          {/* Golden Sun rising */}
          <circle
            cx="490"
            cy="926"
            r="16"
            fill="var(--peach)"
            style={{
              opacity: sunOpacity,
              transform: `translateY(${(1 - sunOpacity) * 8}px)`,
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            }}
          />

          {/* Far Sage Mountain peaks */}
          <path
            d="M 360 958 L 455 918 L 490 938 L 512 926 L 585 958 Z"
            fill="var(--sage)"
            style={{
              opacity: mountainOpacity,
              transform: `translateY(${(1 - mountainOpacity) * 12}px)`,
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            }}
          />
          {/* Snow top on peak */}
          <path
            d="M 455 918 L 472 928 L 438 928 Z"
            fill="#FFFFFF"
            style={{
              opacity: mountainOpacity * 0.95,
              transition: 'opacity 0.2s ease-out',
            }}
          />

          {/* Near Rolling Slope */}
          <path
            d="M 360 958 C 410 946 460 952 510 944 C 555 936 590 942 630 937 L 630 968 H 360 Z"
            fill="var(--sage-deep)"
            style={{
              opacity: mountainOpacity,
              transform: `translateY(${(1 - mountainOpacity) * 8}px)`,
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            }}
          />

          {/* Forest Trees standing on the slope */}
          <g
            fill="var(--forest)"
            style={{
              opacity: mountainOpacity,
              transition: 'opacity 0.2s ease-out',
            }}
          >
            <path d="M 552 938 l 6 10 h -12 Z M 552 932 l 5 9 h -10 Z" />
            <rect x="551" y="946" width="2" height="6" />
            <path d="M 570 942 l 6 10 h -12 Z M 570 936 l 5 9 h -10 Z" />
            <rect x="569" y="950" width="2" height="6" />
          </g>
        </g>

        {/* Destination Pin blooming into place at the logo waypoint */}
        <g
          style={{
            opacity: pinOpacity,
            transformOrigin: '584px 896px',
            transform: `scale(${0.6 + pinOpacity * 0.4})`,
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          }}
        >
          <path
            d="M 584 872 c -8.5 0 -15.5 6.8 -15.5 15.2 c 0 11.5 15.5 27.6 15.5 27.6 s 15.5 -16.1 15.5 -27.6 c 0 -8.4 -7 -15.2 -15.5 -15.2 Z"
            fill="var(--terracotta)"
            className="drop-shadow-[0_2px_8px_rgba(180,83,9,0.5)]"
          />
          <circle cx="584" cy="887.2" r="5.8" fill="var(--surface)" />
        </g>

        {/* Faint Dashed Under-Guide (0.85px, 12% opacity) */}
        <path
          d={JOURNEY_PATH_D}
          stroke="var(--line-strong)"
          strokeWidth="0.85"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.12"
        />

        {/* Curvy, continuous adventure route line that curls up in the CTA section and forms the logo */}
        <path
          ref={pathRef}
          d={JOURNEY_PATH_D}
          stroke="url(#superLightJourneyGrad)"
          strokeWidth="1.65"
          strokeLinecap="round"
          fill="none"
          className="drop-shadow-[0_0_5px_rgba(245,158,11,0.45)]"
        />
      </svg>

      {/* Directional golden arrow smoothly tracing the continuous path and curling into the logo */}
      <div
        style={{
          left: `${arrowPos.xPercent}%`,
          top: `${arrowPos.yPercent}%`,
          transform: `translate(-50%, -50%) rotate(${arrowPos.angle}deg)`,
          opacity: arrowPos.progress >= 0.99 ? 0 : 1,
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
