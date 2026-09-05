import { SkeletonRows } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-sunk h-16 animate-pulse rounded-lg" />
      <SkeletonRows rows={4} />
    </div>
  );
}
