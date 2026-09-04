import 'next-auth';

/**
 * Adds the user id to the session type.
 *
 * Auth.js does not include it by default, and every ownership check in the
 * application needs it, so it is declared once here rather than cast at each
 * call site.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
