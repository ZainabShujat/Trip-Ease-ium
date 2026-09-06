'use client';

import { signOutAction } from '@/app/(auth)/actions';
import { Button } from './ui';

/** Sign out. A form post rather than a link, so it cannot be triggered by a
 *  prefetch or a stray GET. */
export function SignOutButton({ className = '' }: { className?: string }) {
  return (
    <form action={signOutAction} className={`inline-flex items-center ${className}`}>
      <Button type="submit" variant="ghost" size="sm" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
        Sign out
      </Button>
    </form>
  );
}
