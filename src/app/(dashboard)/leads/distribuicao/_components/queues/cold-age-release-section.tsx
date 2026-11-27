"use client";

/** Só na fila "Leads frios" (23/10): o frio vai ao corretor às 9h, quando completa 2 dias. No visual Lite (27/11/2026). */
import { useEffect, useState, useTransition } from "react";

import { toast } from "@/components/ui/sonner";
import { getColdAgeReleaseAction, releaseColdLeadsNowAction, setColdAgeReleaseAction } from "@/features/lead-distribution/cold-age-release-actions";
import { cn } from "@/lib/utils";
import { pl } from "../../plantao/_components/plantoes-1a1-kit";
import { Panel1a1, ToggleRow1a1, pn } from "../panels-1a1";

export function ColdAgeReleaseSection({ queueId, canEdit }: { queueId: string; canEdit: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getColdAgeReleaseAction(queueId).then((config) => { if (active) setEnabled(config.enabled); }).catch(() => { if (active) setEnabled(null); });
    return () => { active = false; };
  }, [queueId]);

  const toggle = (next: boolean) => startTransition(async () => {
    const result = await setColdAgeReleaseAction(queueId, next);
    if (result.success) { setEnabled(result.config.enabled); toast.success(result.message); } else toast.error(result.error);
  });
  const releaseNow = () => startTransition(async () => {
    const result = await releaseColdLeadsNowAction(queueId);
    if (result.success) toast.success(result.message); else toast.error(result.error);
  });

  const hint = "O lead frio só vai para o corretor quando completa 2 dias, todo dia às 9h. Ex.: em 23/10 às 9h saem os frios de 21/10 para trás. Até lá a requalificação automática continua tentando.";

  return (
    <Panel1a1>
      {enabled !== null ? (
        <ToggleRow1a1 title="Liberação dos leads frios" hint={hint} checked={enabled} onChange={toggle} disabled={!canEdit || pending} ariaLabel="Liberar só frios com 2 dias" status={{ on: "Ligada", off: "Desligada" }} />
      ) : (
        <div className={pn.toggle}><div className={pn.toggleText}><p className={pn.toggleTitle}>Liberação dos leads frios</p><p className={pl.small}>{hint}</p></div></div>
      )}
      {canEdit && enabled ? (
        <div className={pn.inline} style={{ flexWrap: "wrap" }}>
          <button type="button" className={cn(pl.pill, pl.pillQuiet)} disabled={pending} onClick={releaseNow}>{pending ? "Liberando…" : "Liberar frios de 2+ dias agora"}</button>
          <span className={pl.small}>Antecipa a liberação de hoje, sem esperar as 9h.</span>
        </div>
      ) : null}
    </Panel1a1>
  );
}
