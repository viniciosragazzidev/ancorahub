import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Carregando conversas" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(16rem,0.68fr)_minmax(0,1.65fr)_20rem]">
        <section className="hidden min-h-0 border-r border-border bg-card lg:block">
          <div className="border-b border-border p-3"><Skeleton className="h-8 w-full" /></div>
          <div className="space-y-3 p-3">{Array.from({ length: 7 }, (_, index) => <Skeleton className="h-16 w-full" key={index} />)}</div>
        </section>
        <section className="flex min-h-0 flex-col bg-muted/15">
          <div className="border-b border-border bg-card p-4"><Skeleton className="h-10 w-64" /></div>
          <div className="flex flex-1 flex-col justify-end gap-3 p-4"><Skeleton className="h-16 w-3/4 self-start" /><Skeleton className="h-20 w-2/3 self-end" /><Skeleton className="h-16 w-1/2 self-start" /></div>
          <div className="border-t border-border bg-card p-4"><Skeleton className="h-11 w-full" /></div>
        </section>
        <aside className="hidden border-l border-border bg-card p-4 lg:block"><Skeleton className="h-24 w-full" /></aside>
      </div>
    </main>
  );
}
