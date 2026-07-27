"use client";

import { useActionState } from "react";
import { PaperPlaneTilt, ShieldCheck } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendWhatsAppReviewMessageAction, type WhatsAppReviewActionState } from "./actions";

const initialState: WhatsAppReviewActionState = {};

export function ReviewMessageForm() {
  const [state, formAction, pending] = useActionState(sendWhatsAppReviewMessageAction, initialState);

  return <form action={formAction} className="space-y-4">
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="review-to">Telefone destinatário</label>
      <Input id="review-to" name="to" autoComplete="tel" inputMode="tel" placeholder="5521999999999" required />
      <p className="text-xs text-muted-foreground">Use o número autorizado no ambiente de teste, com código do país e DDD.</p>
    </div>
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="review-message">Mensagem</label>
      <Textarea id="review-message" name="message" defaultValue="Mensagem de teste enviada pelo CorreTop CRM." maxLength={4096} required />
    </div>
    {state.error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{state.error}</p> : null}
    {state.success ? <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground" role="status"><ShieldCheck className="mr-2 inline size-4 text-primary" />{state.success} ID: <code className="text-xs">{state.messageId}</code></p> : null}
    <Button type="submit" disabled={pending}><PaperPlaneTilt />{pending ? "Enviando…" : "Enviar mensagem de teste"}</Button>
  </form>;
}
