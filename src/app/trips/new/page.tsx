import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { SetupNotice } from '@/components/setup-notice';
import { currentUser, isAuthConfigured } from '@/server/auth/guard';
import { SUPPORTED_DESTINATIONS } from '@/server/trips/service';
import { CreateTripForm } from './form';

/** Reads the session, so it is rendered per request and never prerendered. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Plan a trip' };

export default async function NewTripPage() {
  const configured = isAuthConfigured();
  if (configured) {
    const user = await currentUser();
    if (!user) redirect('/login');
  }

  return (
    <>
      <PageHeader
        eyebrow="New trip"
        title="Plan a trip"
        description="The planner builds a complete day-by-day itinerary, checks it against opening hours and travel times, and keeps it inside your budget — or tells you plainly why it cannot."
      />

      {configured ? <CreateTripForm destinations={SUPPORTED_DESTINATIONS} /> : <SetupNotice />}
    </>
  );
}
