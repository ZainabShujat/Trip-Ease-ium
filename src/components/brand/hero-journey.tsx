'use client';

import { useEffect, useRef, useState } from 'react';

interface ContainerDimensions {
  width: number;
  height: number;
}

interface LogoPosition {
  cx: number;
  cy: number;
  scale: number;
}

function buildJourneyPath(w: number, h: number, cx: number, cy: number, scale: number): string {
  // Percentage to pixel helpers for the top journey across homepage sections
  const px = (pct: number) => (pct / 100) * w;
  const py = (pct: number) => (pct / 100) * h;

  // Authentic mark coordinate mapper: canonical center of the 120x100 logo is (60, 50)
  const lx = (markX: number) => cx + (markX - 60) * scale;
  const ly = (markY: number) => cy + (markY - 50) * scale;

  // Upper page journey coordinates
  const p0 = `${px(51)},${Math.min(80, py(2))}`;
  const c1 = `${px(78)},${py(5)} ${px(84)},${py(9)} ${px(81)},${py(14)}`;
  const c2 = `${px(76)},${py(19)} ${px(50)},${py(21)} ${px(30)},${py(23)}`;
  const c3 = `${px(14)},${py(25)} ${px(14)},${py(30)} ${px(22)},${py(33)}`;
  const c4 = `${px(34)},${py(36)} ${px(72)},${py(37)} ${px(78)},${py(40)}`;
  const c5 = `${px(84)},${py(44)} ${px(82)},${py(49)} ${px(68)},${py(53)}`;
  const c6 = `${px(52)},${py(56)} ${px(25)},${py(58)} ${px(18)},${py(62)}`;
  const c7 = `${px(12)},${py(66)} ${px(15)},${py(70)} ${px(28)},${py(72)}`;
  const c8 = `${px(45)},${py(74)} ${px(82)},${py(76)} ${px(84)},${py(80)}`;

  // Entering the CTA section: swooping smoothly above the CTA headline and curling toward the logo spot
  const curlApproachX = cx - 115 * scale;
  const curlApproachY = cy - 45 * scale;
  const c9 = `${px(86)},${py(83)} ${curlApproachX + 45 * scale},${curlApproachY - 55 * scale} ${curlApproachX},${curlApproachY}`;

  // Loop around and meet the top-left corner of the brand trapezium: (32, 14)
  const c10 = `${curlApproachX - 35 * scale},${curlApproachY + 45 * scale} ${lx(10)},${ly(-15)} ${lx(32)},${ly(14)}`;

  // Trapezium perimeter:
  // Top-left (32, 14) -> Top-right (88, 14)
  const trapTop = `L ${lx(88)} ${ly(14)}`;
  // Top-right (88, 14) -> Bottom-right (108, 84)
  const trapRight = `L ${lx(108)} ${ly(84)}`;
  // Bottom-right (108, 84) -> Bottom-left (12, 84)
  const trapBottom = `L ${lx(12)} ${ly(84)}`;
  // Bottom-left (12, 84) -> Top-left (32, 14)
  const trapLeft = `L ${lx(32)} ${ly(14)}`;

  // Inner winding scenic trail reaching the destination pin:
  const toTrail = `C ${lx(28)} ${ly(35)}, ${lx(18)} ${ly(62)}, ${lx(26)} ${ly(79)}`;
  const trailC1 = `C ${lx(42)} ${ly(77)}, ${lx(40)} ${ly(65)}, ${lx(53)} ${ly(59)}`;
  const trailC2 = `C ${lx(67)} ${ly(52)}, ${lx(69)} ${ly(39)}, ${lx(84)} ${ly(31)}`;
  const toPin = `L ${lx(90)} ${ly(12)}`;

  return `M ${p0} C ${c1} C ${c2} C ${c3} C ${c4} C ${c5} C ${c6} C ${c7} C ${c8} C ${c9} C ${c10} ${trapTop} ${trapRight} ${trapBottom} ${trapLeft} ${toTrail} ${trailC1} ${trailC2} ${toPin}`;
}

export function FullPageJourneyPath() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const lastScrollYRef = useRef(0);
  const scrollDirRef = useRef<'down' | 'up'>('down');
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const currentAngleRef = useRef(180);

  const [dimensions, setDimensions] = useState<ContainerDimensions>({
    width: 1200,
    height: 2600,
  });

  const [logoPos, setLogoPos] = useState<LogoPosition>({
    cx: 600,
    cy: 2350,
    scale: 2.1,
  });

  const [arrowPos, setArrowPos] = useState<{
    x: number;
    y: number;
    angle: number;
    progress: number;
  }>({
    x: 600,
    y: 80,
    angle: 180,
    progress: 0,
  });

  // Measure physical container and CTA spot to keep shapes 100% distortion-free in physical pixels
  useEffect(() => {
    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const width = cRect.width || window.innerWidth || 1200;
      const height = cRect.height || document.documentElement.scrollHeight || 2600;

      const spot = document.getElementById('cta-logo-spot');
      let cx = width / 2;
      let cy = height - 280;
      let scale = Math.min(Math.max(width * 0.22, 170), 280) / 120;

      if (spot) {
        const sRect = spot.getBoundingClientRect();
        cx = sRect.left - cRect.left + sRect.width / 2;
        cy = sRect.top - cRect.top + sRect.height / 2;
        scale = Math.min(Math.max(sRect.width * 0.65, 170), 280) / 120;
      }

      setDimensions({ width, height });
      setLogoPos({ cx, cy, scale });
    };

    updateDimensions();
    const tId = setTimeout(updateDimensions, 150);

    const ro = new ResizeObserver(() => {
      updateDimensions();
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    const spot = document.getElementById('cta-logo-spot');
    if (spot) {
      ro.observe(spot);
    }

    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(tId);
      ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Animation and scroll tracking loop
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
      // Snappy, responsive catch-up factor: tracks scroll quickly without sluggish delay
      const dist = targetProgressRef.current - currentProgressRef.current;
      if (Math.abs(dist) > 0.0001) {
        const factor = Math.min(0.40, 0.20 + Math.abs(dist) * 0.85);
        currentProgressRef.current += dist * factor;
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

        const pixelDx = pEnd.x - pStart.x;
        const pixelDy = pEnd.y - pStart.y;

        // Tangent parallel to the path
        const tangentDown = Math.atan2(pixelDy, pixelDx) * (180 / Math.PI) + 90;
        const tangentUp = Math.atan2(-pixelDy, -pixelDx) * (180 / Math.PI) + 90;

        const desiredAngle = scrollDirRef.current === 'down' ? tangentDown : tangentUp;

        // Shortest-path continuous angle unwrapping to prevent 360-degree spin flips
        let diff = (desiredAngle - currentAngleRef.current) % 360;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        currentAngleRef.current += diff;

        setArrowPos({
          x: pt.x,
          y: pt.y,
          angle: currentAngleRef.current,
          progress,
        });

        // Broadcast current viewport Y of arrow for title alignment glow
        const rect = container.getBoundingClientRect();
        const arrowViewportY = rect.top + pt.y;
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
      if (scrollDelta > 0.3) {
        scrollDirRef.current = 'down';
      } else if (scrollDelta < -0.3) {
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
  }, [dimensions, logoPos]);

  // Dynamic path string computed in true physical 1:1 pixels
  const journeyPathD = buildJourneyPath(
    dimensions.width,
    dimensions.height,
    logoPos.cx,
    logoPos.cy,
    logoPos.scale
  );

  // Proportional reveal stages for the logo as the line curls up in the CTA section
  const groundOpacity = Math.min(Math.max((arrowPos.progress - 0.78) / 0.10, 0), 1);
  const sunOpacity = Math.min(Math.max((arrowPos.progress - 0.82) / 0.10, 0), 1);
  const mountainOpacity = Math.min(Math.max((arrowPos.progress - 0.85) / 0.09, 0), 1);
  const pinOpacity = Math.min(Math.max((arrowPos.progress - 0.94) / 0.05, 0), 1);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 select-none overflow-visible"
    >
      {/* Whisper-soft ambient background gradients */}
      <div className="clip-trapezium bg-sage-soft/10 absolute -top-24 -left-32 h-[500px] w-[600px] -rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/12 absolute top-1/4 -right-36 h-[600px] w-[650px] rotate-12 blur-3xl" />
      <div className="clip-trapezium bg-sage-soft/8 absolute top-1/2 -left-36 h-[600px] w-[600px] rotate-6 blur-3xl" />
      <div className="clip-trapezium-down bg-peach-soft/8 absolute top-3/4 -right-32 h-[550px] w-[600px] -rotate-6 blur-3xl" />

      {/* SVG Canvas in exact 1:1 physical pixel coordinates — zero distortion/squishing */}
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
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

          {/* Authentic brand trapezium clip for the drawn logo centerpiece */}
          <clipPath id="ctaJourneyLogoClip">
            <path d="M 32 14 H 88 L 108 84 H 12 Z" />
          </clipPath>
        </defs>

        {/* LOGO ARTWORK: Uniformly scaled in exact proportion inside the drawn trapezium */}
        <g
          transform={`translate(${logoPos.cx - 60 * logoPos.scale}, ${logoPos.cy - 50 * logoPos.scale}) scale(${logoPos.scale})`}
        >
          <g clipPath="url(#ctaJourneyLogoClip)">
            {/* Ground surface fill */}
            <rect
              x="0"
              y="0"
              width="120"
              height="100"
              fill="var(--surface)"
              style={{
                opacity: groundOpacity,
                transition: 'opacity 0.15s ease-out',
              }}
            />

            {/* Rising Sun — perfectly circular */}
            <circle
              cx="50"
              cy="36"
              r="10.5"
              fill="var(--peach)"
              style={{
                opacity: sunOpacity,
                transform: `translateY(${(1 - sunOpacity) * 10}px)`,
                transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
              }}
            />

            {/* Far Sage Mountain peaks */}
            <path
              d="M-4 88 L34 36 L52 60 L62 49 L88 88 Z"
              fill="var(--sage)"
              style={{
                opacity: mountainOpacity,
                transform: `translateY(${(1 - mountainOpacity) * 12}px)`,
                transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
              }}
            />
            {/* Snow peak */}
            <path
              d="M34 36 L42.5 47.5 L25.5 47.5 Z"
              fill="#FFFFFF"
              style={{
                opacity: mountainOpacity * 0.95,
                transition: 'opacity 0.15s ease-out',
              }}
            />

            {/* Near Rolling Slope */}
            <path
              d="M-4 88 C22 71 46 79 66 70 C86 61 102 66 124 61 L124 96 H-4 Z"
              fill="var(--sage-deep)"
              style={{
                opacity: mountainOpacity,
                transform: `translateY(${(1 - mountainOpacity) * 8}px)`,
                transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
              }}
            />

            {/* Forest Trees standing on the slope */}
            <g
              fill="var(--forest)"
              style={{
                opacity: mountainOpacity,
                transition: 'opacity 0.15s ease-out',
              }}
            >
              <path d="M86 64 l5.5 9.5 h-11 Z M86 58 l4.5 8.5 h-9 Z" />
              <rect x="85" y="72" width="2" height="7" />
              <path d="M98 68 l5.5 9.5 h-11 Z M98 62 l4.5 8.5 h-9 Z" />
              <rect x="97" y="76" width="2" height="7" />
            </g>

            {/* Inner dashed scenic trail */}
            <path
              d="M26 79 C42 77 40 65 53 59 C67 52 69 39 84 31"
              stroke="var(--forest)"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeDasharray="3 4.5"
              fill="none"
              style={{
                opacity: mountainOpacity * 0.4,
                transition: 'opacity 0.15s ease-out',
              }}
            />
          </g>

          {/* Authentic Destination Pin blooming into place at (90, 12) */}
          <g
            style={{
              opacity: pinOpacity,
              transformOrigin: '90px 12px',
              transform: `scale(${0.65 + pinOpacity * 0.35})`,
              transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
            }}
          >
            <path
              d="M90 1 c-6.1 0-11 4.9-11 11 0 8.2 11 19.6 11 19.6 s11-11.4 11-19.6 c0-6.1-4.9-11-11-11 Z"
              fill="var(--terracotta)"
              className="drop-shadow-[0_2px_8px_rgba(180,83,9,0.5)]"
            />
            <circle cx="90" cy="12" r="4.1" fill="var(--surface)" />
          </g>
        </g>

        {/* Faint Dashed Under-Guide along the full journey */}
        <path
          d={journeyPathD}
          stroke="var(--line-strong)"
          strokeWidth="0.85"
          strokeDasharray="3 6"
          fill="none"
          opacity="0.12"
        />

        {/* Curvy, continuous adventure route line that curls up in the CTA section and forms the logo */}
        <path
          ref={pathRef}
          d={journeyPathD}
          stroke="url(#superLightJourneyGrad)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]"
        />
      </svg>

      {/* Directional golden arrow tracking seamlessly with scroll in GPU composited pixels */}
      <div
        style={{
          transform: `translate3d(${arrowPos.x}px, ${arrowPos.y}px, 0) translate(-50%, -50%) rotate(${arrowPos.angle}deg)`,
          opacity: arrowPos.progress >= 0.995 ? 0 : 1,
        }}
        className="pointer-events-none absolute top-0 left-0 z-40 will-change-transform"
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
