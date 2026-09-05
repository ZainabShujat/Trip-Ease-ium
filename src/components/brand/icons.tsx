import type { SVGProps } from 'react';

/**
 * The icon set.
 *
 * Hand-authored line art on one 24-unit grid, with round caps and joins and a
 * single stroke weight, drawn to sit beside the logo rather than beside each
 * other. Deliberately NOT an icon library: mixing a generic pack with a
 * hand-drawn mark is the fastest way to make a product look assembled instead
 * of designed, and it would also add a dependency this pass does not need.
 *
 * Every icon inherits `currentColor`, so colour is the caller's decision and
 * the same glyph works on cream, on forest and inside a badge.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** Transport — a road curving to the horizon rather than a generic vehicle,
 *  because the product plans journeys, not modes. */
export function TransportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 21c2.5-5 4-9 4-12a4 4 0 0 1 8 0c0 3 1.5 7 4 12" />
      <path d="M12 6v2M12 12v2M12 17v1.5" strokeDasharray="0.1 3.2" />
      <path d="M3 21h18" />
    </Icon>
  );
}

/** Stay — a simple pitched roof over an open door. */
export function StayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.8V20h13V9.8" />
      <path d="M10 20v-5.2h4V20" />
    </Icon>
  );
}

/** Places — the location pin from the mark, at icon scale. */
export function PlacesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-6.4 7-11.3A7 7 0 0 0 5 9.7C5 14.6 12 21 12 21Z" />
      <circle cx="12" cy="9.6" r="2.6" />
    </Icon>
  );
}

/** Budget — a coin stack read as bars, matching the budget visualisation. */
export function BudgetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v5c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8V6" />
      <path d="M5 11v5c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-5" />
    </Icon>
  );
}

/** Mountains — used for empty states and section flourishes. */
export function MountainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 19h20L15 7l-3.4 5.8L9.4 9.5 2 19Z" />
      <path d="M12.6 10.4h4.8" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.8h17M8.5 3.2v3.4M15.5 3.2v3.4" />
    </Icon>
  );
}

export function TravellersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.2 19.6c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4" />
      <path d="M16.4 5.2a3.2 3.2 0 0 1 0 6.1M17.6 14.6c2.1.5 3.4 2.3 3.4 5" />
    </Icon>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5 4.5-1.9Z" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7v5.3l3.4 2" />
    </Icon>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 4.5H19.5V10.5" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </Icon>
  );
}

/**
 * A dashed route line, the mark's motif at section scale.
 *
 * `variant` picks how it bends so a page can use several without them reading
 * as copies of one another.
 */
export function RouteLine({
  className = '',
  animated = false,
  variant = 'wave',
}: {
  className?: string;
  animated?: boolean;
  variant?: 'wave' | 'climb';
}) {
  const d =
    variant === 'climb'
      ? 'M2 78 C 90 74 70 40 160 36 C 250 32 235 8 330 6'
      : 'M2 40 C 70 4 120 76 190 40 C 260 4 300 60 358 30';

  return (
    <svg
      viewBox={variant === 'climb' ? '0 0 340 84' : '0 0 360 80'}
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="5 7"
        className={animated ? 'animate-draw' : undefined}
        style={animated ? ({ '--dash': '520' } as React.CSSProperties) : undefined}
      />
    </svg>
  );
}
