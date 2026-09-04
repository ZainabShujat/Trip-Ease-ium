import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';

export default function TripNotFound() {
  return (
    <>
      <PageHeader title="Trip not found" />
      <EmptyState
        title="We could not find that trip"
        description="It may have been deleted, or it belongs to a different account."
        action={<ButtonLink href="/trips">Back to my trips</ButtonLink>}
      />
    </>
  );
}
