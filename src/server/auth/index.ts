import NextAuth from 'next-auth';
import { authConfig } from './config';

/**
 * The Auth.js singleton.
 *
 * `auth()` is the server-side session reader used by pages, route handlers and
 * the `requireUser` guard. Importing this module does not require a database —
 * only actually signing in does.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { authConfig };
export * from './config';
