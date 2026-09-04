import { isAuthConfigured } from '@/server/auth/guard';
import { isDatabaseConfigured } from '@/server/db';
import { env } from '@/server/env';

/**
 * Setup guidance.
 *
 * Shown when the app is running but not fully configured. It names the exact
 * missing variable and the command to run, because "something is not
 * configured" wastes the reader's time.
 */
export function SetupNotice() {
  if (isAuthConfigured()) return null;

  const missing: string[] = [];
  if (!isDatabaseConfigured()) missing.push('DATABASE_URL');
  if (!env().AUTH_SECRET) missing.push('AUTH_SECRET');

  return (
    <section className="border-line-strong bg-surface-alt rounded-lg border p-5">
      <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Setup needed</h2>
      <p className="text-ink-soft mt-2 max-w-3xl text-sm">
        Accounts and saved trips need{' '}
        {missing.map((name, i) => (
          <span key={name}>
            {i > 0 && ' and '}
            <code className="bg-surface rounded px-1 py-0.5 font-mono text-xs">{name}</code>
          </span>
        ))}{' '}
        set in <code className="bg-surface rounded px-1 py-0.5 font-mono text-xs">.env.local</code>.
      </p>
      <ol className="text-ink-soft mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          Create a free Postgres database at{' '}
          <a
            href="https://neon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-4"
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
