"use client";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";

import { DECLINE_REASONS, type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

/** Decline flow: a reason is required before the lead goes back to the distribution. */
export function DeclineSheet({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { showDeclineModal, setShowDeclineModal, declineReason, setDeclineReason, declining, handleConfirmDecline } = c;
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
        <Button variant="danger" size="lg" loading={declining} disabled={declining || !declineReason} onClick={handleConfirmDecline}>
          Recusar lead
        </Button>
      </div>
    </BottomSheet>
  );
}
