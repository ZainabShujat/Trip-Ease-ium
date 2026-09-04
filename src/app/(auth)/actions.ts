'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { RegisterSchema, hashPassword } from '@/server/auth/config';
import { signIn, signOut } from '@/server/auth';
import { db, isDatabaseConfigured } from '@/server/db';

/**
 * Authentication server actions.
 *
 * Deliberately terse error messages on sign-in: "those details did not match"
 * rather than "no account with that email". Distinguishing the two tells an
 * attacker which addresses are registered.
 */

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const NO_DATABASE =
  'Sign-in needs a database. Set DATABASE_URL in .env.local and run `npm run db:migrate`.';

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isDatabaseConfigured()) return { error: NO_DATABASE };

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  try {
    await signIn('credentials', { email, password, redirectTo: '/trips' });
  } catch (error) {
    // next-auth signals a successful redirect by throwing; rethrow so Next can
    // act on it rather than reporting it as a failed sign-in.
    if (error instanceof AuthError) {
      return { error: 'Those details did not match an account.' };
    }
    throw error;
  }
  return {};
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isDatabaseConfigured()) return { error: NO_DATABASE };

  const parsed = RegisterSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const existing = await db().user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { fieldErrors: { email: 'An account already uses that email address.' } };
  }

  await db().user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/trips',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // The account exists; only the automatic sign-in failed.
      redirect('/login');
    }
    throw error;
  }
  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

export async function signInWithGoogleAction(): Promise<void> {
  await signIn('google', { redirectTo: '/trips' });
}
