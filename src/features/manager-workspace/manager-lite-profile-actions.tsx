"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import { Input } from "@/components/ui/input";
import { toggleLiteBrokerStatusAction, updateLiteBrokerContactAction, generateLiteBrokerPasswordResetAction } from "@/app/(dashboard)/equipe/actions";

export function LiteBrokerProfileActions(props: {
  userId: string; name: string; email: string; phone: string; active: boolean; canResetPassword: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"status" | "contact" | "reset" | null>(null);
  const [resetUrl, setResetUrl] = useState("");
  // Feedback nível 1 (FEEDBACK.md): toque vibra, o botão diz "…ando", os dados mudam depois do servidor
  // (router.refresh no lugar de recarregar a página) e a linha confirma; erro com causa e "Tentar de novo".
  const notice = useActionNotice();
  const router = useRouter();

  function run(kind: "status" | "contact" | "reset", action: () => Promise<{ success?: boolean; error?: string; message?: string }>, done: string, failOptions: { fallback: string; keeps: string; retry: () => void }, onSuccess?: (result: { resetUrl?: string }) => void) {
    notice.tap();
    notice.clear();
    setBusy(kind);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.success === false || result.error) notice.fail(result, failOptions);
        else {
          onSuccess?.(result as { resetUrl?: string });
          notice.succeed(result.message ?? done);
          router.refresh();
        }
      } catch (error) {
        notice.fail(error, failOptions);
      } finally {
        setBusy(null);
      }
    });
  }

  function toggleStatus() {
    const nextLabel = props.active ? "desativar" : "reativar";
    if (!window.confirm(`Confirma ${nextLabel} o acesso de ${props.name}? ${props.active ? "O acesso será encerrado e as sessões ativas serão revogadas." : "O corretor poderá acessar o CRM novamente."}`)) return;
    const form = new FormData(); form.set("userId", props.userId);
    applyStatus(form);
  }

  function applyStatus(form: FormData) {
    run("status", () => toggleLiteBrokerStatusAction({}, form), props.active ? "Acesso desativado." : "Acesso reativado.", { fallback: "Não consegui atualizar o acesso agora", keeps: props.active ? "O acesso continua ativo" : "O acesso continua desativado", retry: () => applyStatus(form) });
  }

  function saveContact(formData: FormData) {
    const failOptions = { fallback: "Não consegui salvar os dados agora", keeps: "Os dados anteriores continuam valendo", retry: () => saveContact(formData) };
    run("contact", () => updateLiteBrokerContactAction({ userId: props.userId, name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone") }), "Dados atualizados.", failOptions);
  }

  function resetPassword() {
    if (!window.confirm(`Gerar um link de nova senha para ${props.name}? As sessões atuais do corretor serão encerradas.`)) return;
    const form = new FormData(); form.set("userId", props.userId);
    setResetUrl("");
    run("reset", () => generateLiteBrokerPasswordResetAction({}, form), "Link de nova senha gerado.", { fallback: "Não consegui gerar o link agora", keeps: "A senha atual continua valendo", retry: resetPassword }, (result) => setResetUrl(result.resetUrl ?? ""));
  }

  return <section aria-label="Ações de gestão do corretor" className="grid gap-3 rounded-2xl border border-border bg-card p-4">
    <h2 className="text-base font-medium">Gestão do corretor</h2>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending} aria-busy={busy === "status" || undefined} onClick={toggleStatus}>{busy === "status" ? (props.active ? "Desativando…" : "Reativando…") : props.active ? "Desativar acesso" : "Reativar acesso"}</Button>
      {props.canResetPassword ? <Button variant="outline" disabled={pending} aria-busy={busy === "reset" || undefined} onClick={resetPassword}>{busy === "reset" ? "Gerando…" : "Gerar link de nova senha"}</Button> : null}
    </div>
    <details>
      <summary className="cursor-pointer text-sm font-medium">Editar nome, e-mail e telefone</summary>
      <form action={saveContact} className="mt-3 grid gap-2">
        <Input name="name" aria-label="Nome" defaultValue={props.name} required minLength={2} maxLength={120} />
        <Input name="email" type="email" aria-label="E-mail" defaultValue={props.email} required maxLength={254} />
        <Input name="phone" type="tel" aria-label="Telefone" defaultValue={props.phone} required minLength={8} maxLength={30} />
        <Button disabled={pending} aria-busy={busy === "contact" || undefined}>{busy === "contact" ? "Salvando…" : "Salvar dados"}</Button>
      </form>
    </details>
    <div aria-live="polite" className="grid gap-1 break-all"><ActionNoticeLine notice={notice.notice} />{resetUrl ? <a className="text-sm underline" href={resetUrl}>Abrir link</a> : null}</div>
  </section>;
}
