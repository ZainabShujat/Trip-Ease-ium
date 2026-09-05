'use client';

import { useEffect, useRef, useState } from 'react';

export function HeroTitle() {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const [isGlow, setIsGlow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!h1Ref.current) return;
      const rect = h1Ref.current.getBoundingClientRect();
      const globalArrowY = (window as unknown as { __TEI_ARROW_VIEWPORT_Y__?: number }).__TEI_ARROW_VIEWPORT_Y__;
      const arrowY = typeof globalArrowY === 'number' ? globalArrowY : window.innerHeight * 0.5;

      // Trigger glow and pulsate when the arrow aligns vertically with the title
      const aligned = arrowY >= rect.top - 40 && arrowY <= rect.bottom + 40;
      setIsGlow(aligned);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    window.addEventListener('tei-arrow-scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('tei-arrow-scroll', handleScroll);
    };
  }, []);

  return (
    <h1
      ref={h1Ref}
      className={`text-forest font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-[1.1] max-w-3xl transition-all duration-300 ${
        isGlow
          ? 'tei-glow-active drop-shadow-[0_0_28px_rgba(255,69,0,0.75)] scale-[1.018]'
          : ''
      }`}
    >
      <span className={isGlow ? 'text-[#143324]' : ''}>
        Plan the whole journey.
      </span>
      <span
        className={`block sm:inline transition-colors duration-300 ${
          isGlow
            ? 'text-[#FF3D00] font-bold drop-shadow-[0_0_16px_rgba(255,61,0,0.85)]'
            : 'text-sage-deep'
        }`}
      >
        {' '}Not just the destination.
      </span>
    </h1>
  );
}
