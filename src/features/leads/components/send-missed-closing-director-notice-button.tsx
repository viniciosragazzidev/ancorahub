"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { sendMissedClosingDirectorNoticeAction } from "@/features/leads/closing-director-notice-action";

export function SendMissedClosingDirectorNoticeButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendMissedClosingDirectorNoticeAction(leadId);
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
        Avisar a direção
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogPanel>
            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <DialogTitle>Avisar a direção sobre o fechamento</DialogTitle>
                <DialogDescription>
                  O CRM enviará o resumo do lead aos números configurados para o aviso de fechamento. Cada número recebe no máximo um aviso por lead.
                </DialogDescription>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" loading={pending} onClick={send}>Enviar aviso</Button>
              </div>
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
