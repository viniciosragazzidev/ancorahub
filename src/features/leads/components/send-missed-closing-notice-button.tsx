"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { sendMissedClosingStageNoticeAction } from "@/features/leads/closing-stage-notice-action";

export function SendMissedClosingNoticeButton({ leadId, brokerName }: { leadId: string; brokerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendMissedClosingStageNoticeAction(leadId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setOpen(true)}>
        Enviar parabéns ao corretor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogPanel>
            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <DialogTitle>Enviar aviso de fechamento</DialogTitle>
                <DialogDescription>
                  O CRM enviará uma única mensagem de parabéns para {brokerName} pelo WhatsApp e registrará o disparo. A ação só fica disponível quando ainda não há envio registrado para este lead.
                </DialogDescription>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" loading={pending} onClick={send}>Enviar mensagem</Button>
              </div>
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
