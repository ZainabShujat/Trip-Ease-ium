'use client';

import { signOutAction } from '@/app/(auth)/actions';
import { Button } from './ui';

/** Sign out. A form post rather than a link, so it cannot be triggered by a
 *  prefetch or a stray GET. */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" className="px-3 py-1.5">
        Sign out
      </Button>
    </form>
  );
}
