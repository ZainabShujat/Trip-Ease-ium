'use client';

import { Button, ErrorNote, PageHeader } from '@/components/ui';

/**
 * Trip route error boundary.
 *
 * The likely cause in practice is a database that is unreachable — a wrong or
 * expired Neon connection string, or a free-tier instance that has gone to
 * sleep. Saying that is far more useful than a stack trace, so the message
 * names the probable fix rather than apologising.
 */
export default function TripsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const looksLikeDatabase = /database|connect|ECONNREFUSED|ENOTFOUND|timeout|prisma|password/i.test(
    error.message,
  );

  return (
    <>
      <PageHeader title="Something went wrong" />
      <ErrorNote
        title={
          looksLikeDatabase
            ? 'The database could not be reached.'
            : 'That page could not be loaded.'
        }
      >
        {looksLikeDatabase ? (
          <p>
            Check that <code className="font-mono">DATABASE_URL</code> in{' '}
            <code className="font-mono">.env.local</code> is correct and that the database is awake,
            then try again. Neon free-tier instances sleep when idle and take a few seconds to
            start.
          </p>
        ) : (
          <p>{error.message}</p>
        )}
      </ErrorNote>
      <div>
        <Button onClick={reset} variant="secondary">
          Try again
        </Button>
      </div>
    </>
  );
}
