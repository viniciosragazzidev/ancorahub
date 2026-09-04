"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle, Monitor, WhatsappLogo } from "@/components/huge-icons";
import { X } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { BrokerAvailabilityScheduleEditor } from "./broker-availability-schedule-editor";
import { completeBrokerAvailabilityOnboardingAction, skipBrokerAvailabilityOnboardingAction } from "../actions";
import type { BrokerAvailabilityWindowInput } from "../service";

export function BrokerAvailabilityOnboarding({ initialWindows }: { initialWindows: BrokerAvailabilityWindowInput[] }) {
  const [windows, setWindows] = useState(initialWindows);
  const [step, setStep] = useState(initialWindows.length ? 2 : 1);
  const [open, setOpen] = useState(true);
  const [desktop, setDesktop] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  function complete() {
    startTransition(async () => {
      try {
        await completeBrokerAvailabilityOnboardingAction();
        toast.success("Sua agenda está pronta. Você receberá leads apenas dentro dela.");
        window.location.assign("/dashboard");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível concluir o onboarding.");
      }
    });
  }

  function skip() {
    if (pending) return;
    startTransition(async () => {
      try {
        await skipBrokerAvailabilityOnboardingAction();
        setOpen(false);
        toast.success("Você pode configurar sua disponibilidade em Configurações quando quiser.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível fechar o onboarding.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) skip(); }}>
      <DialogPopup className="flex flex-col max-h-[88dvh] w-[calc(100vw-24px)] max-w-2xl gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        <div className="shrink-0 border-b border-border bg-muted/25 px-5 py-5 sm:px-6 relative">
          <Button type="button" variant="ghost" size="icon-sm" className="absolute right-4 top-4 rounded-full" aria-label="Fechar e configurar depois" onClick={skip} disabled={pending}>
            <X className="size-4" aria-hidden="true" />
          </Button>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Primeira configuração</p>
          <DialogTitle className="mt-2 text-xl">Prepare seu recebimento de leads</DialogTitle>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Você pode informar seus horários agora ou configurar depois em Configurações. A conexão do WhatsApp também é recomendada e opcional.</p>
          <p className="mt-3 text-sm font-medium">Etapa {step} de 2 · {step === 1 ? "Disponibilidade" : "WhatsApp de atendimento"}</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {step === 1 ? <BrokerAvailabilityScheduleEditor initialWindows={windows} submitLabel="Salvar e continuar" onSaved={(saved) => { setWindows(saved); setStep(2); }} /> : (
            <div className="space-y-5">
              <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><WhatsappLogo className="size-4" aria-hidden="true" /></span>
                <div><h2 className="font-semibold">Conecte seu WhatsApp pessoal</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">É recomendado para receber e responder seus atendimentos no CRM. A conexão é pessoal e não altera o número oficial da corretora.</p></div>
              </div>
              {desktop === null ? <p className="text-sm text-muted-foreground">Verificando o melhor modo de conexão…</p> : desktop ? <div className="rounded-lg border border-border p-4"><div className="flex items-center gap-2"><Monitor className="size-4 text-primary" aria-hidden="true" /><p className="font-medium">Você está em um computador</p></div><p className="mt-1 text-sm text-muted-foreground">Abra as configurações para escanear o QR Code e deixar seu atendimento pronto.</p><Button className="mt-3" variant="outline" onClick={() => window.location.assign("/settings?tab=whatsapp")}>Conectar WhatsApp agora</Button></div> : <div className="rounded-lg border border-border p-4"><p className="font-medium">A conexão é melhor no computador</p><p className="mt-1 text-sm text-muted-foreground">Você pode finalizar agora e conectar seu WhatsApp mais tarde em Configurações, usando um computador para escanear o QR Code.</p></div>}
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"><CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />A agenda salva na etapa anterior já está valendo para a distribuição automática.</div>
            </div>
          )}
        </div>
        {step === 2 ? <div className="shrink-0 flex justify-end border-t border-border px-5 py-4 sm:px-6 bg-card"><Button onClick={complete} disabled={pending}>{pending ? "Concluindo…" : "Concluir e entrar no CRM"}</Button></div> : null}
      </DialogPopup>
    </Dialog>
  );
}
