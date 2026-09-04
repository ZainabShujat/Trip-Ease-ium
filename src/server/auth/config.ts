import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { db, isDatabaseConfigured } from '../db';
import { env } from '../env';

/**
 * Authentication.
 *
 * Auth.js v5 with the Prisma adapter. Two ways in:
 *
 *   Google OAuth   — configured only when the credentials are present, so the
 *                    project still runs without a Google Cloud account.
 *   Email/password — bcrypt-hashed, stored on the User row.
 *
 * Sessions are JWT rather than database-backed. The adapter still owns user
 * and account records, but a session lookup on every request would mean a
 * database round trip in middleware, and Vercel's edge runtime cannot open a
 * Postgres connection there.
 *
 * NOTE ON THE VERSION PIN: next-auth v5 is pinned to an exact beta because no
 * stable v5 exists yet and v4 does not support the App Router properly. It is
 * pinned rather than caret-ranged so a later beta cannot arrive unnoticed.
 */

export const CredentialsSchema = z.object({
  email: z.email('enter a valid email address'),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

export const RegisterSchema = CredentialsSchema.extend({
  name: z.string().min(1, 'name is required').max(80),
});

/** Cost factor for password hashing. 12 is the current sensible default. */
export const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function googleProvider() {
  const config = env();
  if (!config.AUTH_GOOGLE_ID || !config.AUTH_GOOGLE_SECRET) return [];
  return [
    Google({
      clientId: config.AUTH_GOOGLE_ID,
      clientSecret: config.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  ];
}

export const authConfig: NextAuthConfig = {
  // The adapter needs a database. Without one the app still boots and mock
  // planning still works; only sign-in is unavailable, and the UI says so.
  ...(isDatabaseConfigured() ? { adapter: PrismaAdapter(db()) } : {}),

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    ...googleProvider(),
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        if (!isDatabaseConfigured()) return null;

        const user = await db().user.findUnique({
          where: { email: parsed.data.email },
        });

        // Compare against a dummy hash when the user does not exist, so a
        // missing account and a wrong password take the same time. Otherwise
        // response timing tells an attacker which emails are registered.
        const hash =
          user?.passwordHash ?? '$2a$12$0000000000000000000000000000000000000000000000000000';
        const valid = await verifyPassword(parsed.data.password, hash);

        if (!user?.passwordHash || !valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },

  trustHost: true,
};
