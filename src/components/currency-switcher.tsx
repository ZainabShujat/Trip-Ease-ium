'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, type SupportedCurrency } from '@/lib/money';

interface CurrencySwitcherProps {
  currentCurrency?: string;
  className?: string;
  onChange?: (currency: SupportedCurrency) => void;
}

/**
 * CurrencySwitcher
 *
 * Allows travellers to switch between INR (default), USD, EUR, and GBP.
 * Automatically updates the URL or invokes the onChange callback.
 */
export function CurrencySwitcher({
  currentCurrency = 'INR',
  className = '',
  onChange,
}: CurrencySwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = (searchParams.get('currency')?.toUpperCase() || currentCurrency) as SupportedCurrency;

  const handleSelect = (c: SupportedCurrency) => {
    if (onChange) {
      onChange(c);
    }
    const params = new URLSearchParams(searchParams.toString());
    if (c === 'INR') {
      params.delete('currency');
    } else {
      params.set('currency', c);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className={`inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-xs ${className}`}>
      <span className="px-2 text-xs font-semibold text-ink-muted uppercase tracking-wider hidden sm:inline-block">
        Currency
      </span>
      {SUPPORTED_CURRENCIES.map((c) => {
        const isSelected = selected === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => handleSelect(c)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              isSelected
                ? 'bg-forest text-cream font-semibold shadow-xs'
                : 'text-ink-soft hover:bg-surface-sunk hover:text-forest'
            }`}
            title={CURRENCY_LABELS[c]}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
