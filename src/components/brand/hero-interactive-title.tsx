'use client';

import { useEffect, useRef, useState } from 'react';

export function HeroTitle() {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const [isGlow, setIsGlow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!h1Ref.current) return;
      const rect = h1Ref.current.getBoundingClientRect();
      const midScreenY = window.innerHeight * 0.5;

      // Trigger glow and pulsate when the mid-screen arrow aligns vertically with the title
      const aligned = midScreenY >= rect.top - 25 && midScreenY <= rect.bottom + 25;
      setIsGlow(aligned);
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
    <h1
      ref={h1Ref}
      className={`text-forest font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-[1.1] max-w-3xl transition-all duration-300 ${
        isGlow
          ? 'drop-shadow-[0_0_24px_rgba(217,111,80,0.6)] scale-[1.015]'
          : ''
      }`}
    >
      <span className={isGlow ? 'animate-pulse text-[#17382a]' : ''}>
        Plan the whole journey.
      </span>
      <span
        className={`block sm:inline transition-colors duration-300 ${
          isGlow
            ? 'text-terracotta font-semibold drop-shadow-[0_0_12px_rgba(217,111,80,0.45)]'
            : 'text-sage-deep'
        }`}
      >
        {' '}Not just the destination.
      </span>
    </h1>
  );
}
