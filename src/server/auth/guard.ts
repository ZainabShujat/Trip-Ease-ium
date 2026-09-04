import { isDatabaseConfigured } from '../db';
import { env } from '../env';
import { auth } from './index';

/**
 * Session guards.
 *
 * Every route that touches a user's data goes through one of these. Ownership
 * is checked against the session on the server, never inferred from an id in
 * the request — a trip id in a URL is a claim, not an authorisation.
 */

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * Is sign-in actually usable?
 *
 * Auth.js needs a signing secret, and the adapter needs a database. Without
 * either, `auth()` throws on every request. Checking first lets the UI say
 * "sign-in is not set up yet" instead of every page erroring — a
 * misconfiguration should be legible, not fatal.
 */
export function isAuthConfigured(): boolean {
  return Boolean(env().AUTH_SECRET) && isDatabaseConfigured();
}

/** The signed-in user, or null. Never throws on a misconfiguration. */
export async function currentUser(): Promise<SessionUser | null> {
  if (!isAuthConfigured()) return null;

  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
    };
  } catch (error) {
    // A broken auth configuration must not take down every page that merely
    // wants to know whether someone is signed in.
    console.error('[auth] session lookup failed:', error);
    return null;
  }
}

/** Thrown by requireUser when there is no session. Mapped to 401 by routes. */
export class UnauthorisedError extends Error {
  constructor() {
    super('You need to be signed in to do that.');
    this.name = 'UnauthorisedError';
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new UnauthorisedError();
  return user;
}
