"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DECLINE_REASONS, type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function DeclineDialog({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { showDeclineModal, setShowDeclineModal, declineReason, setDeclineReason, declining, handleConfirmDecline } = c;
  return (
    <>
        {/* Refuse Lead Modal */}
        <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
          <DialogPopup className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Recusar atendimento de {lead.nome.split(" ")[0]}?
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ao confirmar, este lead será redistribuído automaticamente para outro corretor disponível.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              {DECLINE_REASONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setDeclineReason(r)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border p-3 text-xs font-medium cursor-pointer transition-colors text-left",
                    declineReason === r
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border/70 hover:bg-muted/40",
                  )}
                >
                  <span>{r}</span>
                  <span className={cn(
                    "size-4 rounded-full border flex items-center justify-center text-[10px]",
                    declineReason === r ? "border-primary bg-primary text-primary-foreground font-bold" : "border-border"
                  )}>
                    {declineReason === r ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={declining}
                onClick={() => setShowDeclineModal(false)}
                className="flex-1 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={declining}
                onClick={handleConfirmDecline}
                className="flex-1 text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {declining ? "Devolvendo lead..." : "CONFIRMAR RECUSA"}
              </Button>
            </div>
          </DialogPopup>
        </Dialog>
    </>
  );
}
