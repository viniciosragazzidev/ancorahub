import { ShimmerSkeleton } from "@/components/unlumen-ui/shimmer-skeleton";

export default function MinhaFilaLoading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 sm:p-6 pb-28">
      <div className="space-y-2 border-b border-border/60 pb-4">
        <ShimmerSkeleton className="h-3 w-24" />
        <ShimmerSkeleton className="h-8 w-48" />
      </div>
      <div className="flex gap-2">
        <ShimmerSkeleton className="h-8 w-20" rounded="full" />
        <ShimmerSkeleton className="h-8 w-32" rounded="full" />
        <ShimmerSkeleton className="h-8 w-28" rounded="full" />
      </div>
      <ShimmerSkeleton className="h-10 w-full" rounded="lg" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <ShimmerSkeleton key={index} className="h-36 w-full" rounded="lg" />
        ))}
      </div>
    </main>
  );
}
