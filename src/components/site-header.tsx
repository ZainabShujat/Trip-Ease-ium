import Link from 'next/link';
import { currentUser } from '@/server/auth/guard';
import { ButtonLink } from './ui';
import { SignOutButton } from './auth-buttons';

/**
 * Site chrome.
 *
 * A server component so the signed-in state is correct on first paint — a
 * header that flashes "Sign in" and then swaps to the user's name reads as
 * broken, however briefly.
 */
export async function SiteHeader() {
  const user = await currentUser();

  return (
    <header className="border-line bg-surface border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href={user ? '/trips' : '/'}
          className="hover:text-accent font-semibold tracking-tight"
        >
          AI Travel Planner
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link
                href="/trips"
                className="text-ink-soft hover:bg-surface-alt rounded px-3 py-1.5"
              >
                My trips
              </Link>
              <ButtonLink href="/trips/new" className="px-3 py-1.5">
                Plan a trip
              </ButtonLink>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-ink-soft hover:bg-surface-alt rounded px-3 py-1.5"
              >
                Sign in
              </Link>
              <ButtonLink href="/register" className="px-3 py-1.5">
                Create account
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
