import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { TrapeziumMark } from '@/components/brand/logo';
import { currentUser } from '@/server/auth/guard';
import { env } from '@/server/env';
import { AuthForm } from '../auth-form';
import { signInAction, signInWithGoogleAction } from '../actions';

/** Reads the session, so it is rendered per request and never prerendered. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await currentUser()) redirect('/trips');
  const config = env();
  const googleEnabled = Boolean(config.AUTH_GOOGLE_ID && config.AUTH_GOOGLE_SECRET);

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <TrapeziumMark size={52} />
        <h1 className="text-forest font-serif text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-ink-soft">Pick up a trip where you left it.</p>
      </div>
      <Card>
        <AuthForm
          mode="signin"
          action={signInAction}
          googleEnabled={googleEnabled}
          googleAction={signInWithGoogleAction}
        />
      </Card>
    </>
  );
}
