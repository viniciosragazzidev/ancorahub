import { KeepStageButton } from "./keep-stage-button";

/** Faixa curta no lead em "Aguardando retorno" (05/11): explica e oferece manter na etapa. */
export function AwaitingReplyBanner({ leadId, previousLabel, canKeep }: { leadId: string; previousLabel: string | null; canKeep: boolean }) {
  return (
    <div role="status" className="mx-auto mb-3 flex w-full max-w-3xl flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground">
        <span className="font-medium">Aguardando retorno.</span>{" "}
        <span className="text-muted-foreground">O cliente parou de responder. O lead volta sozinho quando ele responder.</span>
      </p>
      {canKeep ? <KeepStageButton leadId={leadId} previousLabel={previousLabel} /> : null}
    </div>
  );
}
