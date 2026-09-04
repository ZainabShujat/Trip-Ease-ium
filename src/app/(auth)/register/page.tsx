import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { currentUser } from '@/server/auth/guard';
import { env } from '@/server/env';
import { AuthForm } from '../auth-form';
import { registerAction, signInWithGoogleAction } from '../actions';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage() {
  if (await currentUser()) redirect('/trips');
  const config = env();
  const googleEnabled = Boolean(config.AUTH_GOOGLE_ID && config.AUTH_GOOGLE_SECRET);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-ink-soft text-sm">Save your trips and come back to them.</p>
      </div>
      <Card>
        <AuthForm
          mode="register"
          action={registerAction}
          googleEnabled={googleEnabled}
          googleAction={signInWithGoogleAction}
        />
      </Card>
    </>
  );
}
