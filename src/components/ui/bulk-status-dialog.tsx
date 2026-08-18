"use client";

import { useActionState, useEffect, useState } from "react";
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
import type { DistributionActionState } from "@/features/lead-distribution/actions";

export function BulkStatusDialog({
  leadIds,
  role,
  bulkStatusAction,
}: {
  leadIds: string[];
  role: string;
  bulkStatusAction: (
    prev: DistributionActionState,
    formData: FormData,
  ) => Promise<DistributionActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [state, formAction, pending] = useActionState(bulkStatusAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success(
        state.message ?? `${leadIds.length} lead(s) atualizado(s).`,
      );
      setOpen(false);
      setTargetStatus("");
    }
    if (state.error && !state.success) {
      toast.error(state.error);
    }
  }, [state, leadIds.length]);

  const validTargets =
    role === "director" || role === "manager"
      ? ["in_contact", "lost"]
      : ["lost"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <form action={formAction} className="space-y-4">
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

          {state.error && !state.success && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.error}
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
