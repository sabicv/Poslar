import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
