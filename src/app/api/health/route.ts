import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/server/db';
import { describeProviders } from '@/providers/registry';

/**
 * Runtime status.
 *
 * Exists from Phase 1 because "which providers am I actually looking at?" must
 * never be a guess. The settings page and the demo both read this, so mock
 * mode is always visibly mock.
 */
export function GET() {
  try {
    const providers = describeProviders();
    return NextResponse.json({
      status: 'ok',
      phase: 1,
      providerMode: providers.mode,
      providers: providers.providers,
      database: isDatabaseConfigured() ? 'configured' : 'not configured',
      note:
        providers.mode === 'mock'
          ? 'Serving deterministic fixture data. Nothing here is live availability.'
          : 'Live providers active.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'PROVIDER_CONFIG_INVALID',
          message: error instanceof Error ? error.message : 'Unknown provider configuration error',
          retryable: false,
        },
      },
      { status: 500 },
    );
  }
}
