import { Skeleton } from "@/components/ui/skeleton";

export default function UnitProfileLoading() {
  return (
    <div className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
      {/* Back button */}
      <Skeleton className="h-8 w-20 rounded-md" />

      {/* Header */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-7 w-48 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </div>
      </div>

      {/* Metrics cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
