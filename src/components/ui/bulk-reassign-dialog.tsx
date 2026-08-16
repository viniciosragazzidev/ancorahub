"use client";

import { useActionState, useEffect, useState } from "react";
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

export function BulkReassignDialog({
  leadIds,
  brokers = [],
}: {
  leadIds: string[];
  brokers: Array<{ id: string; name: string; branchId: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [state, formAction, pending] = useActionState(
    bulkReassignLeadsAction,
    {},
  );

  useEffect(() => {
    if (state.success) {
      toast.success(
        state.message ?? `Reatribuição concluída para ${leadIds.length} lead(s).`,
      );
      setOpen(false);
      setSelectedBrokerId("");
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, leadIds.length]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline"><UserSwitch className="size-4" /> Reatribuir</Button>} />
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reatribuir leads em lote</DialogTitle>
          <DialogDescription>
            {leadIds.length} lead{leadIds.length === 1 ? "" : "s"} selecionado
            {leadIds.length === 1 ? "" : "s"}. Selecione o novo corretor
            responsável.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
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
