"use client";

import { useActionState, useCallback, useState } from "react";
import { toast } from "sonner";
import { CheckCircle } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppSelect } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { StatusChangeState } from "@/app/(dashboard)/leads/status-actions";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";

export function BulkStatusDialog({
  leadIds,
  role,
  bulkStatusAction,
  onCommitted,
}: {
  leadIds: string[];
  role: string;
  bulkStatusAction: (
    prev: StatusChangeState,
    formData: FormData,
  ) => Promise<StatusChangeState>;
  onCommitted?: (input: { leadIds: string[]; newStatus: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(bulkStatusAction, {});

  const handleSuccess = useCallback((result: typeof state) => {
    toast.success(result.message ?? `${leadIds.length} lead(s) atualizado(s).`);
    setOpen(false);
    setTargetStatus("");
    if (result.changedLeadIds?.length && result.newStatus) {
      onCommitted?.({ leadIds: result.changedLeadIds, newStatus: result.newStatus });
    }
  }, [leadIds.length, onCommitted]);
  const handleError = useCallback((result: typeof state) => {
    if (!result.error) return;
    setVisibleError(result.error);
    toast.error(result.error);
  }, []);

  useActionDialogLifecycle({ state, pending, onSuccess: handleSuccess, onError: handleError });

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !pending) {
      setTargetStatus("");
      setVisibleError(null);
    }
  }, [pending]);

  const validTargets =
    role === "director" || role === "manager"
      ? ["in_contact", "lost"]
      : ["lost"];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline">Alterar status</Button>} />
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar status em lote</DialogTitle>
          <DialogDescription>
            {leadIds.length} lead{leadIds.length === 1 ? "" : "s"} selecionado
            {leadIds.length === 1 ? "" : "s"}.
            {role === "director" || role === "manager"
              ? " Selecione o novo status."
              : " Você pode marcar como perdido."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" onSubmit={() => setVisibleError(null)}>
          {leadIds.map((id) => (
            <input key={id} name="leadIds" type="hidden" value={id} />
          ))}

          <div className="space-y-2">
            <Label htmlFor="target-status">Novo status</Label>
            <AppSelect
              id="target-status"
              name="newStatus"
              value={targetStatus}
              onValueChange={setTargetStatus}
              placeholder="Selecione..."
              required
              options={validTargets.map((status) => ({
                value: status,
                label: LEAD_STATUS_LABELS[status] ?? status,
              }))}
            />
          </div>

          {targetStatus === "lost" && (
            <div className="space-y-2">
              <Label htmlFor="motivo-perda">Motivo da perda</Label>
              <AppSelect
                id="motivo-perda"
                name="motivoPerda"
                required
                placeholder="Selecione um motivo..."
                options={[
                  { value: "preco", label: "Preço acima do esperado" },
                  { value: "carência", label: "Período de carência incompatível" },
                  { value: "encontrou_mais_barato", label: "Encontrou opção mais barata" },
                  { value: "desistiu", label: "Desistiu da contratação" },
                  { value: "problema_saude", label: "Problema de saúde não coberto" },
                  { value: "nao_qualificado", label: "Lead não qualificado" },
                  { value: "outro", label: "Outro motivo" },
                ]}
              />
            </div>
          )}

          {visibleError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {visibleError}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending}>Cancelar</Button>} />
            <Button type="submit" disabled={pending || !targetStatus}>
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Alterando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="size-4" />
                  Confirmar
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
