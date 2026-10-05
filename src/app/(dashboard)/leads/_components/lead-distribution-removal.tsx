"use client";

import { useActionState, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { removeLeadFromDistributionAction, type ManagementActionState } from "@/features/leads/management-actions";
import {
  DISTRIBUTION_REMOVAL_NOTE_MAX,
  DISTRIBUTION_REMOVAL_REASONS,
  distributionRemovalTag,
  isDistributionRemovalReason,
} from "@/features/lead-distribution/distribution-removal";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";

const REASONS = Object.entries(DISTRIBUTION_REMOVAL_REASONS) as Array<[keyof typeof DISTRIBUTION_REMOVAL_REASONS, { label: string; tag: string }]>;

/** Tag of a lead removed from distribution; the note shows on hover. */
export function LeadDistributionRemovedTag({ reason, note }: { reason: string | null | undefined; note?: string | null }) {
  const tag = distributionRemovalTag(reason);
  if (!tag) return null;
  return <Badge variant="secondary" title={note ? `Observação: ${note}` : undefined}>{tag}</Badge>;
}

/**
 * "Remover da distribuição" for a lead without a broker, whatever its stage:
 * asks for the reason and an optional note. Definitive — only a manual
 * assignment to a broker brings the lead back.
 */
export function LeadDistributionRemoval({
  leadId,
  leadName,
  onSuccess,
}: {
  leadId: string;
  leadName?: string;
  onSuccess?: (result: ManagementActionState) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState(removeLeadFromDistributionAction, {});

  const handleSuccess = useCallback((result: ManagementActionState) => {
    setOpen(false);
    setReason("");
    setNote("");
    toast.success("Lead removido da distribuição.");
    onSuccess?.(result);
  }, [onSuccess]);
  const handleError = useCallback((result: ManagementActionState) => {
    if (result.error) toast.error(result.error);
    router.refresh();
  }, [router]);
  useActionDialogLifecycle({ state, pending, onSuccess: handleSuccess, onError: handleError });

  return (
    <div className="space-y-2 rounded-[var(--radius-card)] border border-border/70 bg-card p-3">
      <p className="text-xs font-semibold text-foreground">Distribuição</p>
      <p className="text-xs leading-normal text-muted-foreground">
        Tira o lead da fila de distribuição automática. Ele só volta se for atribuído manualmente a um corretor.
      </p>
      <Button className="w-full justify-center text-xs" onClick={() => setOpen(true)} type="button" variant="outline">
        Remover da distribuição
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup key={open ? "removal-open" : "removal-closed"} className="sm:max-w-md">
          <DialogTitle>Remover da distribuição</DialogTitle>
          <DialogDescription>
            {leadName ? `${leadName} ` : "O lead "}não receberá mais ofertas automáticas. A etapa não muda e o motivo fica visível numa tag.
          </DialogDescription>
          <form action={action} className="mt-4 space-y-4">
            <input name="leadId" type="hidden" value={leadId} />
            <input name="reason" type="hidden" value={reason} />
            <div className="space-y-1.5">
              <Label htmlFor="distribution-removal-reason">Motivo</Label>
              <Select value={reason} onValueChange={(value) => setReason(String(value ?? ""))}>
                <SelectTrigger id="distribution-removal-reason" aria-label="Motivo da remoção">
                  <SelectValue placeholder="Selecione o motivo">
                    {isDistributionRemovalReason(reason) ? DISTRIBUTION_REMOVAL_REASONS[reason].label : "Selecione o motivo"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="distribution-removal-note">Observação (opcional)</Label>
              <Textarea
                id="distribution-removal-note"
                name="note"
                maxLength={DISTRIBUTION_REMOVAL_NOTE_MAX}
                placeholder="Ex.: corretor externo que recebeu, contexto da desqualificação…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
              <Button type="submit" variant="destructive" disabled={!isDistributionRemovalReason(reason) || pending}>
                {pending ? "Removendo…" : "Remover da distribuição"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
