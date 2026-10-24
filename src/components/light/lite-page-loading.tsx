import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Lite page frame while the server renders (Fase 1 de performance, 24/10): a route with
 * no loading screen kept the old page on screen until every query finished, and people
 * clicked again thinking the tap was lost. Same frame as .lite-page (venancor-scope.css).
 */
export function LitePageLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-5 bg-(--surface) text-(--foreground)" aria-label={label} aria-busy="true">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-48 rounded-full" />
        <Skeleton className="h-4 w-72 max-w-full rounded-full" />
      </div>
      <Skeleton className="h-36 rounded-[var(--radius-panel)]" />
      <section className="grid gap-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 rounded-[var(--radius-panel)]" />)}
      </section>
    </main>
  );
}
