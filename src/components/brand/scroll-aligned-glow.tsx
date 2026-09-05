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
    const checkAlignment = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const globalArrowY = (window as unknown as { __TEI_ARROW_VIEWPORT_Y__?: number }).__TEI_ARROW_VIEWPORT_Y__;
      const arrowY = typeof globalArrowY === 'number' ? globalArrowY : window.innerHeight * 0.5;

      // When the arrow is vertically within this element (with 50px leeway)
      const aligned = arrowY >= rect.top - 50 && arrowY <= rect.bottom + 50;
      setIsAligned(aligned);
    };

    window.addEventListener('scroll', checkAlignment, { passive: true });
    window.addEventListener('resize', checkAlignment, { passive: true });
    window.addEventListener('tei-arrow-scroll', checkAlignment, { passive: true });
    checkAlignment();

    return () => {
      window.removeEventListener('scroll', checkAlignment);
      window.removeEventListener('resize', checkAlignment);
      window.removeEventListener('tei-arrow-scroll', checkAlignment);
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
