'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import type { AuthFormState } from './actions';

/**
 * Shared sign-in / register form.
 *
 * `useActionState` keeps the submitted values and any error on the page after
 * a failed attempt, so a mistyped password does not wipe the email too.
 */
export function AuthForm({
  mode,
  action,
  googleEnabled,
  googleAction,
}: {
  mode: 'signin' | 'register';
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  googleEnabled: boolean;
  googleAction: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {});
  const isRegister = mode === 'register';

  return (
    <div className="flex flex-col gap-5">
      {state.error && <ErrorNote title={state.error} />}

      <form action={formAction} className="flex flex-col gap-4">
        {isRegister && (
          <Field label="Name" error={state.fieldErrors?.name}>
            <Input name="name" autoComplete="name" required maxLength={80} />
          </Field>
        )}

        <Field label="Email" error={state.fieldErrors?.email}>
          <Input name="email" type="email" autoComplete="email" required />
        </Field>

        <Field
          label="Password"
          hint={isRegister ? 'At least 8 characters.' : undefined}
          error={state.fieldErrors?.password}
        >
          <Input
            name="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={8}
          />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="text-muted flex items-center gap-3 text-xs">
            <span className="bg-line h-px flex-1" />
            or
            <span className="bg-line h-px flex-1" />
          </div>
          <form action={googleAction}>
            <Button type="submit" variant="secondary" className="w-full">
              Continue with Google
            </Button>
          </form>
        </>
      )}

      <p className="text-ink-soft text-sm">
        {isRegister ? 'Already have an account? ' : 'No account yet? '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="text-accent underline underline-offset-4"
        >
          {isRegister ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </div>
  );
}
