import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { currentUser } from '@/server/auth/guard';
import { env } from '@/server/env';
import { AuthForm } from '../auth-form';
import { signInAction, signInWithGoogleAction } from '../actions';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await currentUser()) redirect('/trips');
  const config = env();
  const googleEnabled = Boolean(config.AUTH_GOOGLE_ID && config.AUTH_GOOGLE_SECRET);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-ink-soft text-sm">Pick up a trip where you left it.</p>
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
