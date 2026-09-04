import { z } from 'zod';

/**
 * Environment validation.
 *
 * Deliberately lenient about what is REQUIRED: the whole point of Phase 1 is
 * that the project runs, tests and type-checks with an empty environment.
 * Nothing here throws at import time. Modules that genuinely need a variable
 * (the database client, the Phase 6 LLM client) ask for it explicitly and
 * fail with a message naming what to set.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PROVIDER_MODE: z.enum(['mock', 'live']).default('mock'),

  DATABASE_URL: z.string().min(1).optional(),

  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  MAPTILER_API_KEY: z.string().min(1).optional(),

  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL_FAST: z.string().default('gemini-2.5-flash'),
  GEMINI_MODEL_REASONING: z.string().default('gemini-2.5-pro'),

  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let parsed: Env | null = null;

export function env(): Env {
  if (!parsed) {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    parsed = result.data;
  }
  return parsed;
}

/** Test hook — re-read process.env after a test mutates it. */
export function resetEnvCache(): void {
  parsed = null;
}

/**
 * Read a variable that a feature genuinely cannot work without, failing with
 * an actionable message rather than `undefined` propagating into a stack trace
 * three layers away.
 */
export function requireEnv(key: keyof Env, feature: string): string {
  const value = env()[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `${feature} requires ${key}, which is not set. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}
