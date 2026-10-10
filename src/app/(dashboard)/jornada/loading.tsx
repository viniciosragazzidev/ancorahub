import { Skeleton } from "@/components/arc/skeleton/skeleton";

/** Same shape as the journey screen, so nothing jumps when it loads. */
export default function JourneyLoading() {
  return (
    <div className="arc-venancor min-h-full bg-[var(--surface)]" role="status" aria-busy="true" aria-label="Carregando sua jornada">
      <div className="mx-auto grid w-full max-w-[640px] gap-7 px-4 pb-14 pt-6">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-44 rounded-full" />
          <Skeleton className="h-4 w-72 max-w-full rounded-full" />
        </div>
        <Skeleton className="h-36 w-full rounded-[var(--radius-panel)]" />
        <div className="grid gap-2">
          <Skeleton className="h-5 w-36 rounded-full" />
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 w-full rounded-[var(--radius-panel)]" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-[var(--radius-panel)]" />
      </div>
    </div>
  );
}
