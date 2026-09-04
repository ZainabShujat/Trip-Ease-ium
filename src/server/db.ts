import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { requireEnv } from './env';

/**
 * Prisma client singleton.
 *
 * Prisma 7 connects through a driver adapter rather than a URL in the schema,
 * so the connection string is read here — lazily. Importing this module does
 * not require DATABASE_URL; only calling `db()` does. That is what lets the
 * test suite and mock-mode pages run against an empty environment.
 *
 * The global cache prevents Next.js's dev-mode hot reload from opening a new
 * connection pool on every edit, which exhausts Postgres connection limits.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = requireEnv('DATABASE_URL', 'The database');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export function db(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/** True when a database is configured. Lets routes degrade honestly. */
export function isDatabaseConfigured(): boolean {
  return typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
}
