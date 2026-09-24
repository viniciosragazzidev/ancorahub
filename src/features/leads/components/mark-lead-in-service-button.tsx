"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@/components/huge-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { markLeadInServiceAction } from "@/features/leads/director-service-start-action";

/**
 * Director-only override: marks an assigned lead as "Em atendimento" on behalf
 * of its broker, confirming ownership and stopping automatic redistribution.
 */
export function MarkLeadInServiceButton({
  leadId,
  brokerName,
  onDone,
}: {
  leadId: string;
  brokerName: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await markLeadInServiceAction(leadId);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível marcar o lead como em atendimento.");
        router.refresh();
        return;
      }
      toast.success("Lead marcado como em atendimento.");
      setOpen(false);
      onDone?.();
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CheckCircle className="size-4" />
        Marcar em atendimento
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogPopup className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como em atendimento?</DialogTitle>
            <DialogDescription>
              O lead ficará confirmado com {brokerName ?? "o corretor responsável"} e não será mais redistribuído
              automaticamente. O corretor será avisado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending}>Cancelar</Button>} />
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending ? "Marcando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
