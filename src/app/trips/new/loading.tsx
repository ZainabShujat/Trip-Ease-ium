import { SkeletonRows } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-alt h-16 animate-pulse rounded-lg" />
      <SkeletonRows rows={3} />
    </div>
  );
}
