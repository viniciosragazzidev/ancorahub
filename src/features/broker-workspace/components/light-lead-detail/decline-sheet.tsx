"use client";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { LiteSuccess } from "@/components/lite/motion";

import { DECLINE_REASONS, type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

/**
 * Decline flow: a reason is required before the lead goes back to the distribution.
 * Feedback nível 1 (FEEDBACK.md): "Recusando…" enquanto o servidor responde; o check "Lead devolvido"
 * aparece na própria folha só depois da confirmação; a falha mostra a causa abaixo do botão, sem toast.
 */
export function DeclineSheet({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { showDeclineModal, setShowDeclineModal, declineReason, setDeclineReason, declining, declined, declineError, handleConfirmDecline } = c;
  const firstName = lead.nome.split(" ")[0];

  return (
    <BottomSheet
      open={showDeclineModal}
      onOpenChange={setShowDeclineModal}
      title={`Recusar ${firstName}?`}
      description="O lead volta para a distribuição e outro corretor disponível assume o atendimento."
      detents={[0.72]}
      closeLabel="Fechar"
      className="arc-venancor"
    >
      <div className="flex flex-col gap-5 pb-2">
        <RadioCards
          aria-label="Motivo da recusa"
          layout="list"
          options={DECLINE_REASONS.map((reason) => ({ value: reason, label: reason }))}
          value={declineReason || null}
          onValueChange={setDeclineReason}
          required
        />
        {declined ? (
          <LiteSuccess label="Lead devolvido. Outro corretor assume o atendimento." className="min-h-11 text-sm font-medium text-(--success)" />
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="danger" size="lg" loading={declining} disabled={declining || !declineReason} aria-describedby={declineError ? "decline-sheet-error" : undefined} onClick={handleConfirmDecline}>
              {declining ? "Recusando…" : declineError ? "Tentar de novo" : "Recusar lead"}
            </Button>
            {declineError ? <p id="decline-sheet-error" role="alert" className="text-sm text-(--danger)">{declineError}</p> : null}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
