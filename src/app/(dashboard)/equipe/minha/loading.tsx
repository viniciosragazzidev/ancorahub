import { Skeleton } from "@/components/ui/skeleton";

export default function MyTeamLoading() {
  return (
    <main className="arc-venancor min-h-full bg-[var(--surface)] px-4 py-6 text-[var(--foreground)]" aria-label="Carregando equipe" aria-busy="true">
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 rounded-[var(--radius-panel)]" />
        <Skeleton className="h-10 w-full max-w-md rounded-full" />
        <section className="grid gap-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 rounded-[var(--radius-panel)]" />)}
        </section>
      </div>
    </main>
  );
}
