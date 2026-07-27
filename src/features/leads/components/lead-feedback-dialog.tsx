"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, ArrowRight, ArrowLeft, MagicWand } from "@/components/huge-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogDescription, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { submitLeadFeedbackAction, type LeadFeedbackState } from "@/features/leads/feedback-actions";

const events = [
  ["contacted", "Contato realizado"],
  ["callback_requested", "Pediu retorno"],
  ["quote_sent", "Cotação enviada"],
  ["documentation_pending", "Documentos pendentes"],
  ["no_answer", "Não respondeu"],
  ["no_interest", "Sem interesse"],
] as const;

const reactions = [
  ["interested", "Demonstrou interesse"],
  ["uncertain", "Ficou em dúvida"],
  ["unresponsive", "Ainda não respondeu"],
  ["resistant", "Teve resistência"],
] as const;

export function LeadFeedbackDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(1);
  const [eventType, setEventType] = useState<(typeof events)[number][0]>("contacted");
  const [reaction, setReaction] = useState<(typeof reactions)[number][0]>("interested");
  const [nextAction, setNextAction] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState<LeadFeedbackState, FormData>(submitLeadFeedbackAction, {});
  const needsDate = useMemo(() => eventType === "callback_requested" || eventType === "documentation_pending", [eventType]);

  useEffect(() => {
    if (!state.success) return;
    toast.success("Memória do atendimento registrada.");
    setStep(1); setNote(""); setNextAction(""); setFollowUpAt("");
    onOpenChange(false);
  }, [state.success, onOpenChange]);
  useEffect(() => { if (state.error) toast.error(state.error); }, [state.error]);

  function submit(formData: FormData) {
    formData.set("leadId", leadId);
    formData.set("type", eventType);
    formData.set("content", note);
    formData.set("nextAction", nextAction);
    formData.set("nextActionAt", followUpAt);
    action(formData);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogPopup className="overflow-hidden p-0 sm:max-w-xl">
      <DialogPanel className="gap-0">
        <div className="border-b border-border bg-primary/[0.04] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-primary"><MagicWand className="size-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Memória do atendimento</span></div>
          <DialogTitle className="mt-2">Contexto salvo em poucos segundos</DialogTitle>
          <DialogDescription className="mt-1">Ajude a próxima ação a ficar clara, sem escrever um relatório.</DialogDescription>
          <div className="mt-4 flex gap-1.5" aria-label={`Etapa ${step} de 3`}>{[1, 2, 3].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${item <= step ? "bg-primary" : "bg-muted"}`} />)}</div>
        </div>
        <form action={submit} className="grid gap-5 px-5 py-5 sm:px-6">
          {step === 1 && <section className="t-feedback-step grid gap-3"><p className="text-sm font-medium">O que aconteceu?</p><div className="grid grid-cols-2 gap-2">{events.map(([value, label]) => <button key={value} type="button" onClick={() => setEventType(value)} className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${eventType === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}><span className="flex items-center justify-between gap-2">{label}{eventType === value && <Check size={16} weight="bold" />}</span></button>)}</div></section>}
          {step === 2 && <section className="t-feedback-step grid gap-3"><p className="text-sm font-medium">Como o cliente reagiu?</p><div className="grid gap-2">{reactions.map(([value, label]) => <button key={value} type="button" onClick={() => setReaction(value)} className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${reaction === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}><span className="flex items-center justify-between gap-2">{label}{reaction === value && <Check size={16} weight="bold" />}</span></button>)}</div></section>}
          {step === 3 && <section className="t-feedback-step grid gap-4"><div><p className="text-sm font-medium">Qual é a próxima ação?</p><p className="mt-1 text-xs text-muted-foreground">Opcional. Use uma frase curta para não perder o contexto.</p></div><Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Ex.: Retornar com uma alternativa" maxLength={200} />{needsDate && <label className="grid gap-2 text-sm"><span>Quando retomar?</span><Input type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} /></label>}<label className="grid gap-2 text-sm"><span>Observação <span className="font-normal text-muted-foreground">(opcional)</span></span><Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="O que vale lembrar?" maxLength={1000} /></label></section>}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4"><Button type="button" variant="ghost" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)} disabled={pending}>{step === 1 ? "Agora não" : <><ArrowLeft /> Voltar</>}</Button>{step < 3 ? <Button type="button" onClick={() => setStep(step + 1)}>Continuar <ArrowRight /></Button> : <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar memória"}</Button>}</div>
        </form>
      </DialogPanel>
    </DialogPopup>
  </Dialog>;
}
