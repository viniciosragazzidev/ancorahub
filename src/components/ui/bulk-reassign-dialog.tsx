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
            <select
              id="broker-select"
              name="brokerId"
              value={selectedBrokerId}
              onChange={(e) => setSelectedBrokerId(e.target.value)}
              required
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Selecione um corretor...</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.name}
                </option>
              ))}
            </select>
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
