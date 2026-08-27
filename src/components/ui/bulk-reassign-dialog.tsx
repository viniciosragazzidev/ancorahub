"use client";

import { useActionState, useCallback, useState } from "react";
import { toast } from "sonner";
import { UserSwitch } from "@/components/huge-icons";
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
import { bulkReassignLeadsAction } from "@/app/(dashboard)/leads/status-actions";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";

export function BulkReassignDialog({
  leadIds,
  brokers = [],
  onCommitted,
}: {
  leadIds: string[];
  brokers: Array<{ id: string; name: string; branchId: string | null }>;
  onCommitted?: (input: { leadIds: string[]; brokerId: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    bulkReassignLeadsAction,
    {},
  );

  const handleSuccess = useCallback((result: typeof state) => {
    toast.success(result.message ?? `Reatribuição concluída para ${leadIds.length} lead(s).`);
    setOpen(false);
    setSelectedBrokerId("");
    if (result.changedLeadIds?.length && result.brokerId) {
      onCommitted?.({ leadIds: result.changedLeadIds, brokerId: result.brokerId });
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
      setSelectedBrokerId("");
      setVisibleError(null);
    }
  }, [pending]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline"><UserSwitch className="size-4" /> Reatribuir</Button>} />
      <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reatribuir leads em lote</DialogTitle>
          <DialogDescription>
            {leadIds.length} lead{leadIds.length === 1 ? "" : "s"} selecionado
            {leadIds.length === 1 ? "" : "s"}. Selecione o novo corretor
            responsável.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" onSubmit={() => setVisibleError(null)}>
          {leadIds.map((id) => (
            <input key={id} name="leadIds" type="hidden" value={id} />
          ))}

          <div className="space-y-2">
            <Label htmlFor="broker-select">Corretor</Label>
            <AppSelect
              id="broker-select"
              name="brokerId"
              value={selectedBrokerId}
              onValueChange={setSelectedBrokerId}
              placeholder="Selecione um corretor..."
              required
              options={brokers.map((broker) => ({
                value: broker.id,
                label: broker.name,
              }))}
            />
          </div>

          {visibleError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {visibleError}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending}>Cancelar</Button>} />
            <Button type="submit" disabled={pending || !selectedBrokerId}>
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Reatribuindo...
                </span>
              ) : (
                "Confirmar reatribuição"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
