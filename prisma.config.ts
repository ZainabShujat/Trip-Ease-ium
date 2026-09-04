import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the connection URL out of schema.prisma and into this file.
 * Only the CLI (migrate, introspect, studio) reads it — the application
 * connects through the driver adapter in src/server/db.ts.
 *
 * DATABASE_URL is intentionally not required at import time: `npm test`,
 * `npm run typecheck` and mock-mode pages all run without a database, and
 * failing here would break them. Migration commands fail with a clear message
 * from the CLI instead.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
