'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ScrollGlowHeadingProps {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'div' | 'p' | 'span';
  className?: string;
  activeClassName?: string;
}

export function ScrollGlowHeading({
  children,
  as: Component = 'h2',
  className = '',
  activeClassName = '',
}: ScrollGlowHeadingProps) {
  const ref = useRef<HTMLElement>(null);
  const [isAligned, setIsAligned] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const midY = window.innerHeight * 0.5;

      // When the mid-screen arrow aligns vertically with this element (within 40px margin)
      const aligned = midY >= rect.top - 40 && midY <= rect.bottom + 40;
      setIsAligned(aligned);
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
    <Component
      // @ts-expect-error polymorphic ref
      ref={ref}
      className={`transition-all duration-300 ${className} ${
        isAligned
          ? `tei-glow-active drop-shadow-[0_0_24px_rgba(255,69,0,0.65)] ${activeClassName}`
          : ''
      }`}
    >
      {children}
    </Component>
  );
}
