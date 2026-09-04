import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Shared presentational primitives.
 *
 * No business logic and no data fetching — architecture rule §15.2. Each takes
 * what it renders as props so the same component works on a server page and
 * inside a client form.
 */

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-alt',
  ghost: 'text-ink-soft hover:bg-surface-alt',
  danger: 'border border-crit/40 bg-transparent text-crit hover:bg-crit/10',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cx(
        'border-line bg-surface rounded-lg border p-5 shadow-[var(--shadow)]',
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-line-strong flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-ink-soft max-w-prose">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const BADGE_BASE =
  'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-semibold ' +
  'tracking-[0.04em] uppercase whitespace-nowrap';

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: 'neutral' | 'accent' | 'flag' | 'ok' | 'crit' }) {
  const tones = {
    neutral: 'bg-surface-alt text-muted',
    accent: 'bg-accent-soft text-accent',
    flag: 'bg-flag-soft text-flag',
    ok: 'bg-accent-soft text-ok',
    crit: 'bg-flag-soft text-crit',
  };
  return <span className={cx(BADGE_BASE, tones[tone], className)} {...props} />;
}

/**
 * Provenance badge.
 *
 * The visible half of the data-honesty rule: anything not live is marked, in
 * the reserved rust colour, wherever it is shown. This component is the reason
 * a viewer can never mistake a fixture price for a quotation.
 */
export function SourceBadge({ sourceKind }: { sourceKind: string }) {
  if (sourceKind === 'live' || sourceKind === 'cached') {
    return <Badge tone="ok">live</Badge>;
  }
  return (
    <Badge tone="flag" title="Not live availability — verify with the provider before booking.">
      {sourceKind === 'mock' ? 'sample data' : 'estimated'}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-line-strong flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-ink-soft max-w-md text-sm">{description}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-crit/30 bg-flag-soft/60 rounded-lg border p-4">
      <p className="text-crit font-medium">{title}</p>
      {children && <div className="text-ink-soft mt-1 text-sm">{children}</div>}
    </div>
  );
}

/** Skeleton matching the shape of what is loading, not a generic spinner. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-line bg-surface-alt h-24 animate-pulse rounded-lg border" />
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
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-muted text-xs">{hint}</span>}
      {error && <span className="text-crit text-xs">{error}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/40';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(CONTROL, 'min-h-24 resize-y', className)} {...props} />;
}

/** Multi-select rendered as toggle chips — faster to scan than a listbox. */
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
      <span className="border-line-strong text-ink-soft peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:outline-accent inline-block rounded-full border px-3 py-1 text-sm transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
        {label}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Budget progress. Turns rust once spending passes the budget. */
export function BudgetBar({
  estimatedMinor,
  budgetMinor,
}: {
  estimatedMinor: number;
  budgetMinor: number;
}) {
  const ratio = budgetMinor > 0 ? estimatedMinor / budgetMinor : 0;
  const width = Math.min(100, Math.round(ratio * 100));
  const over = estimatedMinor > budgetMinor;

  return (
    <div
      className="bg-surface-alt h-1.5 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={`${width}% of budget used`}
    >
      <div
        className={cx('h-full rounded-full', over ? 'bg-crit' : 'bg-accent')}
        style={{ width: `${Math.max(2, width)}%` }}
      />
    </div>
  );
}
