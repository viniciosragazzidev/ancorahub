"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useOptimistic } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogPopup,
  DialogPanel,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  changeLeadStatusAction,
  type StatusChangeState,
} from "@/app/(dashboard)/leads/status-actions";
import {
  LEAD_STATUS_LABELS,
  MOTIVOS_PERDA,
  MOTIVO_PERDA_LABELS,
  VALID_TRANSITIONS,
} from "@/features/leads/lead-status-constants";
import { LeadFeedbackDialog } from "./lead-feedback-dialog";
import { RegisterSalePanel } from "@/app/(dashboard)/leads/[id]/register-sale-panel";
import { NextStatusSuggestion } from "./next-status-suggestion";

type ConfirmationDocument = { id: string; filename: string; status: string };
type CarrierOption = { id: string; name: string };

type LeadStatusSelectorProps = {
  leadId: string;
  currentStatus: string;
  role: string;
  isOwner: boolean;
  isSameBranch: boolean;
  documents?: ConfirmationDocument[];
  carriers?: CarrierOption[];
};

function statusLabel(status: string): string {
  return (LEAD_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export function LeadStatusSelector({
  leadId,
  currentStatus,
  role,
  isOwner,
  isSameBranch,
  documents = [],
  carriers = [],
}: LeadStatusSelectorProps) {
  const router = useRouter();
  const [showLostConfirm, setShowLostConfirm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackAfterStatus, setFeedbackAfterStatus] = useState(false);
  const [showSaleConfirm, setShowSaleConfirm] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [state, dispatch, pending] = useActionState<StatusChangeState, FormData>(
    changeLeadStatusAction,
    {},
  );

  // Optimistic UI state
  const [optimisticStatus, addOptimisticStatus] = useOptimistic(
    currentStatus,
    (_current, newStatus: string) => newStatus,
  );

  const canEdit =
    role === "director" ||
    (role === "manager" && isSameBranch) ||
    (role === "broker" && isOwner);

  const canReopen = role === "manager" || role === "director";
  const displayedStatus = pending ? optimisticStatus : currentStatus;

  useEffect(() => {
    if (state.success) {
      toast.success("Status alterado com sucesso.");
      if (feedbackAfterStatus) setShowFeedback(true);
      setFeedbackAfterStatus(false);
      router.refresh();
    } else if (state.error) {
      setFeedbackAfterStatus(false);
      toast.error(state.error);
    }
  }, [state.success, state.error, router]);

  const submitChange = (status: string, motivo?: string) => {
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("newStatus", status);
    if (motivo) formData.set("motivoPerda", motivo);
    setFeedbackAfterStatus(role === "broker" && status !== "lost");
    addOptimisticStatus(status);
    startTransition(() => dispatch(formData));
  };

  const handleStatusSelect: (value: string | null | undefined) => void = (value) => {
    if (!value || value === displayedStatus) return;

    if (value === "lost") {
      setShowLostConfirm(true);
      return;
    }

    if (value === "converted") {
      setShowSaleConfirm(true);
      return;
    }

    submitChange(value);
  };

  const confirmLost = () => {
    if (!motivoPerda) {
      toast.error("Selecione um motivo de perda.");
      return;
    }
    submitChange("lost", motivoPerda);
    setShowLostConfirm(false);
    setMotivoPerda("");
  };

  const cancelLost = () => {
    setShowLostConfirm(false);
    setMotivoPerda("");
  };

  const availableStatuses = (() => {
    if (displayedStatus === "lost") {
      if (canReopen) return VALID_TRANSITIONS.lost as string[];
      return [];
    }

    return [...(VALID_TRANSITIONS[displayedStatus] ?? [])];
  })();

  if (!canEdit || (displayedStatus === "lost" && !canReopen)) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <NextStatusSuggestion
          currentStatus={displayedStatus}
          onSelectStatus={handleStatusSelect}
          disabled={pending}
        />
        <Badge
          variant={displayedStatus === "lost" ? "destructive" : "outline"}
          className={`transition-opacity ${state.error ? "t-sync-error" : ""} ${pending ? "t-sync-local" : "t-sync-confirmed"}`}
        >
          {pending ? "Sincronizando" : statusLabel(displayedStatus)}
        </Badge>
        {availableStatuses.length > 0 && (
          <Select value={undefined} onValueChange={handleStatusSelect}>
            <SelectTrigger className="w-[180px]" disabled={pending}>
              <SelectValue placeholder="Alterar status..." />
            </SelectTrigger>
            <SelectContent>
              {displayedStatus === "lost" && canReopen && (
                <SelectItem value="reopen-placeholder" disabled>
                  Reabrir lead
                </SelectItem>
              )}
              {availableStatuses.filter((s) => s !== "lost").map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
              {availableStatuses.includes("lost") && (
                <>
                  <SelectSeparator />
                  <SelectItem value="lost" className="text-destructive">
                    Perdido
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Confirmation dialog for lost leads */}
      <Dialog open={showLostConfirm} onOpenChange={setShowLostConfirm}>
        <DialogPopup>
          <DialogPanel>
            <div className="p-6">
              <DialogTitle>Perder lead</DialogTitle>
              <DialogDescription>
                Informe o motivo para registrar o lead como perdido.
              </DialogDescription>
              <div className="mt-4 space-y-4">
                <select
                  className="flex h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm"
                  defaultValue=""
                  onChange={(e) => setMotivoPerda(e.target.value)}
                  value={motivoPerda}
                >
                  <option value="" disabled>
                    Selecione o motivo...
                  </option>
                  {MOTIVOS_PERDA.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {MOTIVO_PERDA_LABELS[motivo]}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelLost} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={confirmLost} disabled={!motivoPerda || pending}>
                    {pending ? "Salvando..." : "Confirmar Perda"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
      <LeadFeedbackDialog leadId={leadId} open={showFeedback} onOpenChange={setShowFeedback} />
      <RegisterSalePanel leadId={leadId} documents={documents} carriers={carriers} open={showSaleConfirm} onOpenChange={setShowSaleConfirm} />
    </>
  );
}
