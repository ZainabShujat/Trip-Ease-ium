import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { CheckIcon } from './brand/icons';

/**
 * The Trip-Ease-Ium component library.
 *
 * Every surface in the product is built from these, so the whole application
 * looks like one thing. No page defines its own button, card or badge.
 * Presentational only — no business logic, no data fetching (rule §15.2).
 */

export function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-[background-color,color,border-color,transform,box-shadow] duration-150 ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-55';

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Terracotta is the single loudest thing on a page, so only the one action
  // that actually matters gets it.
  primary: 'bg-terracotta text-white shadow-[var(--shadow-sm)] hover:bg-terracotta-deep',
  secondary:
    'border border-forest/25 bg-surface text-forest hover:border-forest/50 hover:bg-sage-soft',
  quiet: 'bg-forest text-cream hover:bg-forest-deep',
  ghost: 'text-ink-soft hover:bg-surface-sunk hover:text-forest',
  danger: 'border border-crit/35 text-crit hover:bg-crit-soft',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      className={cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  className,
  interactive = false,
  ...props
}: ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        'border-line bg-surface rounded-lg border p-5 shadow-[var(--shadow-sm)]',
        interactive && 'lift hover:border-sage',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Section heading with a small trapezium tick.
 *
 * The geometry appears here rather than around every card: a repeated small
 * cue reads as a system, a repeated large one reads as a gimmick.
 */
export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cx(
        'text-ink-muted flex items-center gap-2.5 font-mono text-xs font-semibold tracking-[0.16em] uppercase',
        className,
      )}
    >
      <span aria-hidden className="clip-trapezium bg-sage h-2.5 w-3.5 shrink-0" />
      {children}
    </h2>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="border-line flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b pb-6">
      <div className="flex flex-col gap-2">
        {eyebrow && (
          <p className="text-sage-deep font-mono text-xs tracking-[0.16em] uppercase">{eyebrow}</p>
        )}
        <h1 className="text-forest font-serif text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        {description && <div className="text-ink-soft max-w-prose">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

type BadgeTone = 'neutral' | 'sage' | 'terracotta' | 'peach' | 'ok' | 'warn' | 'crit';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunk text-ink-soft',
  sage: 'bg-sage-soft text-sage-deep',
  terracotta: 'bg-terracotta-soft text-terracotta-deep',
  peach: 'bg-peach-soft text-terracotta-deep',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  crit: 'bg-crit-soft text-crit',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Trip status, as a small clipped geometric chip. */
export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === 'PLANNED' || status === 'COMPLETED'
      ? 'sage'
      : status === 'DRAFT_INVALID' || status === 'CANCELLED'
        ? 'crit'
        : status === 'TRAVELLING' || status === 'BOOKING'
          ? 'terracotta'
          : 'neutral';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cx('clip-trapezium h-2.5 w-3.5', BADGE_TONES[tone])} />
      <Badge tone={tone}>{status.replace(/_/g, ' ').toLowerCase()}</Badge>
    </span>
  );
}

/**
 * Provenance.
 *
 * The visible half of the data-honesty rule. Worded for a traveller rather
 * than a developer — "sample planning data", not "mock provider" — while still
 * saying plainly that it is not live availability.
 */
export function SourceBadge({ sourceKind }: { sourceKind: string }) {
  if (sourceKind === 'live' || sourceKind === 'cached') return <Badge tone="ok">live</Badge>;
  return (
    <Badge tone="peach" title="Researched estimate — confirm with the provider before booking.">
      {sourceKind === 'mock' ? 'sample data' : 'estimated'}
    </Badge>
  );
}

/** The full, calm explanation of where planning figures come from. */
export function SampleDataNote({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'border-peach bg-peach-soft/60 flex items-start gap-3 rounded-md border px-4 py-3',
        className,
      )}
    >
      <span aria-hidden className="clip-trapezium bg-terracotta mt-1 h-3 w-4 shrink-0" />
      <p className="text-ink-soft text-sm">
        <span className="text-forest font-semibold">Sample planning data.</span> Transport and
        accommodation prices are researched estimates. Availability is confirmed with the provider
        before you book.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function EmptyState({
  illustration,
  title,
  description,
  action,
}: {
  illustration?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-line-strong bg-surface/60 flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
      {illustration}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-forest font-serif text-xl font-bold">{title}</h2>
        <p className="text-ink-soft mx-auto max-w-md text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-crit/30 bg-crit-soft/70 rounded-lg border p-4" role="alert">
      <p className="text-crit font-medium">{title}</p>
      {children && <div className="text-ink-soft mt-1 text-sm">{children}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-line bg-surface-sunk h-24 animate-pulse rounded-lg border" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-forest text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-ink-muted text-xs">{hint}</span>}
      {error && (
        <span className="text-crit text-xs font-medium" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

const CONTROL =
  'w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink ' +
  'transition-colors placeholder:text-ink-muted hover:border-sage focus:border-sage';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(CONTROL, 'cursor-pointer', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(CONTROL, 'min-h-24 resize-y', className)} {...props} />;
}

/** Multi-select as toggle chips — faster to scan and to tap than a listbox. */
export function CheckboxChip({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="border-line-strong bg-surface text-ink-soft hover:border-sage peer-checked:border-sage peer-checked:bg-sage-soft peer-checked:text-sage-deep peer-focus-visible:outline-terracotta inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors select-none peer-checked:font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
        {label}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

/** A labelled figure. Used across the trip header and stat rows. */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-ink-muted font-mono text-[11px] tracking-[0.14em] uppercase">
        {label}
      </span>
      <span className="tabular text-forest text-lg font-semibold">{value}</span>
      {sub && <span className="text-ink-muted text-xs">{sub}</span>}
    </div>
  );
}

/** Overall budget bar. Turns terracotta only when genuinely over. */
export function BudgetBar({
  estimatedMinor,
  budgetMinor,
  className,
}: {
  estimatedMinor: number;
  budgetMinor: number;
  className?: string;
}) {
  const ratio = budgetMinor > 0 ? estimatedMinor / budgetMinor : 0;
  const width = Math.min(100, Math.round(ratio * 100));
  const over = estimatedMinor > budgetMinor;

  return (
    <div
      className={cx('bg-surface-sunk h-2 w-full overflow-hidden rounded-full', className)}
      role="img"
      aria-label={`${width}% of the budget used`}
    >
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-700',
          over ? 'bg-terracotta' : 'bg-sage',
        )}
        style={{ width: `${Math.max(2, width)}%` }}
      />
    </div>
  );
}

/**
 * Readiness.
 *
 * Trapezoid segments rather than a plain bar: it is the one progress surface
 * in the product, so it is where the geometry earns its place. Segments fill
 * left to right, and the count is stated in words too, because a row of
 * shapes is a picture and a person wants the number.
 */
export function ReadinessMeter({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  return (
    <div
      className={cx('flex items-center gap-1.5', className)}
      role="img"
      aria-label={`${done} of ${total} things ready`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx(
            'clip-trapezium h-5 flex-1 transition-colors duration-500',
            i < done ? 'bg-sage' : 'bg-surface-sunk',
          )}
        />
      ))}
    </div>
  );
}

/** One line of the readiness checklist. */
export function ReadinessRow({
  label,
  done,
  detail,
}: {
  label: string;
  done: boolean;
  detail?: string;
}) {
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span
        aria-hidden
        className={cx(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
          done ? 'border-sage bg-sage text-white' : 'border-line-strong bg-surface',
        )}
      >
        {done && <CheckIcon size={12} strokeWidth={2.6} />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cx('text-sm', done ? 'text-ink-soft' : 'text-forest font-medium')}>
          {label}
        </span>
        {detail && <span className="text-ink-muted text-xs">{detail}</span>}
      </span>
    </li>
  );
}
