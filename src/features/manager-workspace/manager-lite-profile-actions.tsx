"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleLiteBrokerStatusAction, updateLiteBrokerContactAction, generateLiteBrokerPasswordResetAction } from "@/app/(dashboard)/equipe/actions";

export function LiteBrokerProfileActions(props: {
  userId: string; name: string; email: string; phone: string; active: boolean; canResetPassword: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  function toggleStatus() {
    const nextLabel = props.active ? "desativar" : "reativar";
    if (!window.confirm(`Confirma ${nextLabel} o acesso de ${props.name}? ${props.active ? "O acesso será encerrado e as sessões ativas serão revogadas." : "O corretor poderá acessar o CRM novamente."}`)) return;
    const form = new FormData(); form.set("userId", props.userId);
    startTransition(async () => { const result = await toggleLiteBrokerStatusAction({}, form); setFeedback(result.error ?? result.message ?? (result.success ? "Status atualizado." : "Não foi possível atualizar.")); if (result.success) window.location.reload(); });
  }

  function saveContact(formData: FormData) {
    startTransition(async () => { const result = await updateLiteBrokerContactAction({ userId: props.userId, name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone") }); setFeedback(result.error ?? result.message ?? "Dados atualizados."); if (result.success) window.location.reload(); });
  }

  function resetPassword() {
    if (!window.confirm(`Gerar um link de nova senha para ${props.name}? As sessões atuais do corretor serão encerradas.`)) return;
    const form = new FormData(); form.set("userId", props.userId);
    startTransition(async () => { const result = await generateLiteBrokerPasswordResetAction({}, form); setFeedback(result.error ?? "Link de nova senha gerado."); setResetUrl(result.resetUrl ?? ""); });
  }

  return <section aria-label="Ações de gestão do corretor" className="grid gap-3 rounded-2xl border border-border bg-card p-4">
    <h2 className="text-base font-medium">Gestão do corretor</h2>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending} onClick={toggleStatus}>{props.active ? "Desativar acesso" : "Reativar acesso"}</Button>
      {props.canResetPassword ? <Button variant="outline" disabled={pending} onClick={resetPassword}>Gerar link de nova senha</Button> : null}
    </div>
    <details>
      <summary className="cursor-pointer text-sm font-medium">Editar nome, e-mail e telefone</summary>
      <form action={saveContact} className="mt-3 grid gap-2">
        <Input name="name" aria-label="Nome" defaultValue={props.name} required minLength={2} maxLength={120} />
        <Input name="email" type="email" aria-label="E-mail" defaultValue={props.email} required maxLength={254} />
        <Input name="phone" type="tel" aria-label="Telefone" defaultValue={props.phone} required minLength={8} maxLength={30} />
        <Button disabled={pending}>Salvar dados</Button>
      </form>
    </details>
    {feedback ? <p role="status" aria-live="polite" className="break-all text-sm text-muted-foreground">{feedback}{resetUrl ? <> <a className="underline" href={resetUrl}>Abrir link</a></> : null}</p> : null}
  </section>;
}
