import Link from 'next/link';
import { currentUser } from '@/server/auth/guard';
import { Logo } from './brand/logo';
import { ButtonLink } from './ui';
import { SignOutButton } from './auth-buttons';

/**
 * Site chrome.
 *
 * A server component so the signed-in state is right on first paint; a header
 * that flashes "Sign in" and then swaps to the user's name reads as broken,
 * however briefly.
 */
export async function SiteHeader() {
  const user = await currentUser();

  return (
    <header className="border-line bg-cream/85 sticky top-0 z-30 border-b backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link
          href={user ? '/trips' : '/'}
          className="rounded transition-opacity hover:opacity-80"
          aria-label="Trip-Ease-ium home"
        >
          <Logo size={28} wordmarkClassName="text-base sm:text-xl" className="sm:gap-2.5" />
        </Link>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link
                href="/trips"
                className="text-ink-soft hover:bg-surface-sunk hover:text-forest rounded-md px-3 py-2 text-sm font-medium transition-colors"
              >
                My trips
              </Link>
              <ButtonLink href="/trips/new" size="sm" className="whitespace-nowrap">
                Plan a trip
              </ButtonLink>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-ink-soft hover:bg-surface-sunk hover:text-forest rounded-md px-3 py-2 text-sm font-medium transition-colors"
              >
                Sign in
              </Link>
              <ButtonLink href="/register" size="sm" className="whitespace-nowrap">
                Plan a trip
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
