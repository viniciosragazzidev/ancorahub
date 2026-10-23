"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { SheetSection, SheetSectionHeader } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { getColdAgeReleaseAction, releaseColdLeadsNowAction, setColdAgeReleaseAction } from "@/features/lead-distribution/cold-age-release-actions";

/** Leads Frios queue only (23/10): cold leads go to brokers at 9h, once they are 2 days old. */
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

  return (
    <SheetSection>
      <SheetSectionHeader>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Liberação dos leads frios</p>
          <p className="text-xs text-muted-foreground">
            O lead frio só vai para o corretor quando completa 2 dias, todo dia às 9h. Ex.: em 23/10 às 9h saem os frios de 21/10 para trás. Até lá a requalificação automática continua tentando.
          </p>
        </div>
        {enabled !== null ? (
          <Switch checked={enabled} disabled={!canEdit || pending} onCheckedChange={(checked) => toggle(checked === true)} aria-label="Liberar só frios com 2 dias" />
        ) : null}
      </SheetSectionHeader>
      {canEdit && enabled ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={releaseNow}>
            Liberar frios de 2+ dias agora
          </Button>
          <span className="text-xs text-muted-foreground">Antecipa a liberação de hoje, sem esperar as 9h.</span>
        </div>
      ) : null}
    </SheetSection>
  );
}
