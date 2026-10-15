import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerUnitLoading() {
  return (
    <main className="arc-venancor min-h-full bg-[var(--surface)] px-4 py-6 text-[var(--foreground)] lg:px-8" aria-label="Carregando unidade" aria-busy="true">
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="grid gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </header>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-[var(--radius-panel)]" />)}
        </section>
        <section className="grid gap-5 lg:grid-cols-2" aria-hidden="true">
          <Skeleton className="h-72 rounded-[var(--radius-panel)]" />
          <Skeleton className="h-72 rounded-[var(--radius-panel)]" />
        </section>
      </div>
    </main>
  );
}
