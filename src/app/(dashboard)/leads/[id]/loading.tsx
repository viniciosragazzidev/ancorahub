import { Skeleton } from "@/components/arc/skeleton/skeleton";

/** The lead screen while its data loads: the same two columns as the real screen, never a blank page (2026-10-17). */
export default function LeadLoading() {
  return (
    <div className="arc-venancor grid h-[var(--app-dvh,100dvh)] min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-(--surface) lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:grid-rows-none" aria-busy="true">
      <div className="flex flex-col gap-4 bg-(--surface-muted) p-4 lg:p-5">
        <Skeleton avatar lines={2} label="Carregando o lead" />
        <div className="rounded-3xl bg-(--surface) p-4 shadow-(--shadow-resting)">
          <Skeleton lines={2} label="Carregando o próximo passo" />
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-3 p-4">
        <Skeleton lines={6} label="Carregando a conversa" />
      </div>
    </div>
  );
}
