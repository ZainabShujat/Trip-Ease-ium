import { isAuthConfigured } from '@/server/auth/guard';
import { isDatabaseConfigured } from '@/server/db';
import { env } from '@/server/env';

/**
 * Setup guidance — for developers, not for travellers.
 *
 * Environment variable names, connection strings and migration commands are
 * implementation details. Showing them to a visitor is noise at best and an
 * information leak at worst, so the technical version only renders in
 * development. In production an unconfigured install says the honest, useful
 * thing — accounts are unavailable — and nothing more.
 */
export function SetupNotice() {
  if (isAuthConfigured()) return null;

  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) {
    return (
      <div className="border-line bg-surface rounded-lg border px-5 py-4">
        <p className="text-ink-soft text-sm">
          <span className="text-forest font-medium">Accounts are temporarily unavailable.</span> You
          can still explore how planning works: saving trips will be back shortly.
        </p>
      </div>
    );
  }

  const missing: string[] = [];
  if (!isDatabaseConfigured()) missing.push('DATABASE_URL');
  if (!env().AUTH_SECRET) missing.push('AUTH_SECRET');

  return (
    <section className="border-line-strong bg-surface-sunk/70 rounded-lg border border-dashed p-5">
      <h2 className="text-ink-muted font-mono text-xs tracking-[0.16em] uppercase">
        Developer setup · shown in development only
      </h2>
      <p className="text-ink-soft mt-2 max-w-3xl text-sm">
        Accounts and saved trips need{' '}
        {missing.map((name, i) => (
          <span key={name}>
            {i > 0 && ' and '}
            <code className="bg-surface text-forest rounded px-1 py-0.5 font-mono text-xs">
              {name}
            </code>
          </span>
        ))}{' '}
        in <code className="bg-surface rounded px-1 py-0.5 font-mono text-xs">.env.local</code>.
      </p>
      <ol className="text-ink-soft mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          Create a free Postgres database at{' '}
          <a
            href="https://neon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-terracotta-deep underline underline-offset-4"
          >
            neon.com
          </a>{' '}
          and copy the connection string.
        </li>
        <li>
          Run{' '}
          <code className="bg-surface rounded px-1 py-0.5 font-mono text-xs">npx auth secret</code>{' '}
          to generate a signing key.
        </li>
        <li>
          Put both in{' '}
          <code className="bg-surface rounded px-1 py-0.5 font-mono text-xs">.env.local</code>, then
          run{' '}
          <code className="bg-surface rounded px-1 py-0.5 font-mono text-xs">
            npm run db:migrate
          </code>
          .
        </li>
      </ol>
    </section>
  );
}
