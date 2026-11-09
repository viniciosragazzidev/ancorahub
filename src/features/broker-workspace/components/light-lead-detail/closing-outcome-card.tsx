"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { toast } from "@/components/ui/sonner";
import { holdClosingOutcomeAction } from "@/features/leads/closing-outcome-actions";
import { CLOSING_HOLD_MAX_DAYS } from "@/features/leads/closing-outcome-core";
import { CLOSING_STAGE_STATUSES } from "@/features/leads/closing-stage-notice-core";

import { toLocalDateKey } from "./format";
import type { LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Desfecho pendente (09/11): o lead está no fechamento há mais de 10 dias sem mudança de etapa. O corretor
 * responde em um toque: Fechou (registrar a venda), Perdeu (motivo da perda) ou Continua em análise (data prevista).
 */
type OutcomeController = Pick<LeadDetailController, "leadStatus" | "setShowSaleConfirm" | "setSelectedStep" | "setObservation" | "setRegressionJustification" | "setShowUpdateSheet">;

export function ClosingOutcomeCard({ lead, c }: { lead: LightLeadDetailData; c: OutcomeController }) {
  const router = useRouter();
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdDate, setHoldDate] = useState("");
  // Calculado ao abrir a data prevista (de amanhã até 60 dias), nunca durante o render.
  const [bounds, setBounds] = useState<{ min: Date; max: Date } | null>(null);
  const [saving, startSaving] = useTransition();
  const [answered, setAnswered] = useState(false);

  const outcome = lead.closingOutcome;
  if (!outcome?.pending || !lead.isCurrentBroker || answered || !CLOSING_STAGE_STATUSES.has(c.leadStatus)) return null;

  function openLost() {
    c.setSelectedStep("no_interest");
    c.setObservation("");
    c.setRegressionJustification("");
    c.setShowUpdateSheet(true);
  }

  function saveHold() {
    if (!holdDate) {
      toast.error("Escolha a data prevista.");
      return;
    }
    startSaving(async () => {
      const result = await holdClosingOutcomeAction({ leadId: lead.id, expectedDate: holdDate });
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      toast.success(result.message);
      setHoldOpen(false);
      setAnswered(true);
      router.refresh();
    });
  }

  function openHold() {
    const now = Date.now();
    setBounds({ min: new Date(now + DAY_MS), max: new Date(now + CLOSING_HOLD_MAX_DAYS * DAY_MS) });
    setHoldDate("");
    setHoldOpen(true);
  }

  return (
    <>
      <section aria-labelledby="closing-outcome-heading" className="arc-venancor flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
        <div>
          <h2 id="closing-outcome-heading" className="text-base font-semibold text-(--foreground)">
            Desfecho pendente
          </h2>
          <p className="mt-1 text-sm text-(--text-secondary)">
            {outcome.daysInClosing} dias no fechamento sem mudar de etapa. O que aconteceu com este cliente?
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => c.setShowSaleConfirm(true)}>Fechou</Button>
          <Button variant="secondary" onClick={openLost}>Perdeu</Button>
          <Button variant="ghost" onClick={openHold}>Continua em análise</Button>
        </div>
      </section>

      <BottomSheet
        open={holdOpen}
        onOpenChange={setHoldOpen}
        title="Continua em análise"
        description="Quando você espera ter a resposta da operadora ou do cliente? Até essa data o lead não aparece como pendente."
        detents={[0.7]}
        closeLabel="Fechar"
        className="arc-venancor"
      >
        <div className="flex flex-col gap-5 pb-2">
          <DatePicker
            label="Data prevista"
            locale="pt-BR"
            placeholder="Escolher data"
            minDate={bounds?.min}
            maxDate={bounds?.max}
            value={holdDate ? new Date(`${holdDate}T12:00:00`) : undefined}
            onChange={(date) => setHoldDate(date ? toLocalDateKey(date) : "")}
          />
          <Button size="lg" loading={saving} disabled={saving} onClick={saveHold}>
            Salvar data prevista
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
