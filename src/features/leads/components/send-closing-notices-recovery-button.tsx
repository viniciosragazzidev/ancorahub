"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { sendClosingNoticesRecoveryAction } from "@/features/leads/closing-notices-recovery-action";

export function SendClosingNoticesRecoveryButton({
  leadId,
  brokerName,
  summary,
  allRegistered,
  allSent,
}: {
  leadId: string;
  brokerName: string | null;
  summary: string;
  allRegistered: boolean;
  allSent: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resultText, setResultText] = useState<string | null>(null);

  function send() {
    startTransition(async () => {
      const result = await sendClosingNoticesRecoveryAction(leadId);
      setResultText(result.success ? result.summary : `${result.error ?? "Falha no envio"} · ${result.summary}`);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível enviar os avisos.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const buttonText = resultText
    ?? (allRegistered
      ? allSent
        ? "Parabéns e aviso à direção já enviados"
        : "Avisos de fechamento já registrados"
      : "Enviar parabéns e aviso à direção");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-w-full whitespace-normal"
        disabled={pending || allRegistered}
        onClick={() => setOpen(true)}
        title={allRegistered ? summary : undefined}
        aria-live="polite"
      >
        {pending ? "Enviando avisos…" : buttonText}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogPanel>
            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <DialogTitle>Enviar parabéns e aviso à direção</DialogTitle>
                <DialogDescription>
                  O CRM envia somente as mensagens que ainda não têm registro. Os parabéns vão para {brokerName || "o corretor responsável"}; o aviso vai para os números configurados para a direção.
                </DialogDescription>
              </div>
              <p className="text-sm text-muted-foreground" role="status">{summary}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" loading={pending} onClick={send}>Confirmar envio</Button>
              </div>
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
