"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { LiteSuccess } from "@/components/lite/motion";
import { Textarea } from "@/components/arc/textarea/textarea";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { validateReturnDueAt } from "@/features/carteira/proxima-acao-core";
import { addLeadNoteAction } from "@/features/leads/actions";
import { createLeadTaskAction } from "@/features/leads/task-actions";

import { localInputToSaoPauloIso } from "../light-client-next-action";

import styles from "./broker-client-profile.module.css";

/** Mesmo título dos retornos da carteira (a próxima ação e a Agenda leem a tarefa aberta do lead). */
const RETORNO_TITULO = "Retorno";

type Sheet = null | "contato" | "atendimento" | "retorno";

/**
 * Ações rápidas do perfil: contato com os dados existentes, registrar atendimento (nota do lead, autorizada e
 * auditada pela action existente) e agendar retorno (tarefa do lead, autorizada e auditada). Só de leitura quando
 * o cliente não está na carteira do corretor; o servidor confere de novo em cada action.
 * Feedback nível 1 (docs/design-system/FEEDBACK.md): toque vibra curto, o check só depois do servidor, sem som;
 * a falha mostra a causa normalizada e o que continua valendo, e o mesmo botão tenta de novo.
 */
export function ProfileQuickActions({ client, canAct, readOnlyReason }: {
  client: { leadId: string; name: string; phone: string | null };
  canAct: boolean;
  readOnlyReason: string | null;
}) {
  const router = useRouter();
  const fire = useFeedback();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [note, setNote] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const waUrl = buildWhatsAppUrl(client.phone);
  const phoneDigits = client.phone?.replace(/\D/g, "") ?? "";

  function open(kind: Exclude<Sheet, null>) {
    setError(null);
    setFeedback(null);
    setSheet(kind);
  }

  function saveNote() {
    const content = note.trim();
    if (!content) {
      setError("Escreva o que foi conversado.");
      return;
    }
    setError(null);
    fire("tap");
    startTransition(async () => {
      const form = new FormData();
      form.set("leadId", client.leadId);
      form.set("content", content);
      let result: Awaited<ReturnType<typeof addLeadNoteAction>>;
      try {
        result = await addLeadNoteAction({}, form);
      } catch (cause) {
        result = { error: normalizeActionError(cause).cause };
      }
      if (result.error) {
        // O texto digitado fica no campo para tentar de novo.
        setError(actionErrorMessage(normalizeActionError(result, "O atendimento não foi registrado"), "O texto continua no campo"));
        fire("error");
        return;
      }
      fire("confirm");
      setNote("");
      setSheet(null);
      setFeedback("Atendimento registrado no histórico");
      router.refresh();
    });
  }

  function saveReturn() {
    const dueAt = localInputToSaoPauloIso(returnDate);
    const check = validateReturnDueAt(dueAt, new Date());
    if (!check.ok) {
      setError(dueAt ? check.reason : "Escolha a data e a hora do retorno.");
      return;
    }
    setError(null);
    fire("tap");
    startTransition(async () => {
      const form = new FormData();
      form.set("leadId", client.leadId);
      form.set("title", RETORNO_TITULO);
      form.set("priority", "normal");
      form.set("dueAt", check.dueAt.toISOString());
      if (returnNote.trim()) form.set("description", returnNote.trim());
      let result: Awaited<ReturnType<typeof createLeadTaskAction>>;
      try {
        result = await createLeadTaskAction({}, form);
      } catch (cause) {
        result = { error: normalizeActionError(cause).cause };
      }
      if (result.error) {
        setError(actionErrorMessage(normalizeActionError(result, "O retorno não foi agendado"), "A data continua escolhida"));
        fire("error");
        return;
      }
      fire("confirm");
      setReturnDate("");
      setReturnNote("");
      setSheet(null);
      setFeedback("Retorno agendado. Aparece na Agenda e no resumo");
      router.refresh();
    });
  }

  return (
    <div className={styles.quickActions}>
      <div className={styles.quickRow} role="group" aria-label="Ações rápidas">
        <Button variant="primary" onClick={() => open("contato")} disabled={!waUrl && !phoneDigits}>Contato</Button>
        <Button variant="secondary" onClick={() => open("atendimento")} disabled={!canAct}>Registrar atendimento</Button>
        <Button variant="secondary" onClick={() => open("retorno")} disabled={!canAct}>Agendar retorno</Button>
      </div>
      {!waUrl && !phoneDigits ? <p className={styles.hint}>Sem telefone cadastrado para contato.</p> : null}
      {!canAct && readOnlyReason ? <p className={styles.hint}>{readOnlyReason}</p> : null}
      {/* Confirmação no próprio lugar: o check se desenha logo abaixo das ações. */}
      {feedback ? <LiteSuccess label={feedback} className={styles.feedback} /> : null}

      <BottomSheet open={sheet === "contato"} onOpenChange={(value) => setSheet(value ? "contato" : null)} title="Falar com o cliente" description={client.name} detents={[0.45]} closeLabel="Fechar" className="arc-venancor">
        <div className={styles.sheetBody}>
          {waUrl ? <a href={waUrl} target="_blank" rel="noopener noreferrer" className={styles.sheetLink}>Abrir no WhatsApp</a> : null}
          {phoneDigits ? <a href={`tel:${phoneDigits}`} className={styles.sheetLink}>Ligar para {client.phone}</a> : null}
          {canAct ? <Link href={`/leads/${encodeURIComponent(client.leadId)}`} className={styles.sheetLink}>Abrir a conversa do lead</Link> : null}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "atendimento"} onOpenChange={(value) => setSheet(value ? "atendimento" : null)} title="Registrar atendimento" description="Fica no histórico do cliente com seu nome, data e hora." detents={[0.7]} closeLabel="Fechar" className="arc-venancor">
        <div className={styles.sheetBody}>
          <Textarea label="O que foi conversado" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} error={error ?? undefined} />
          <Button size="lg" loading={pending} disabled={pending} onClick={saveNote}>Salvar no histórico</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "retorno"} onOpenChange={(value) => setSheet(value ? "retorno" : null)} title="Agendar retorno" description="Data e hora em horário de São Paulo." detents={[0.7]} closeLabel="Fechar" className="arc-venancor">
        <div className={styles.sheetBody}>
          <Input label="Quando" type="datetime-local" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} required error={error ?? undefined} />
          <Textarea label="Observação (opcional)" value={returnNote} onChange={(event) => setReturnNote(event.target.value)} maxLength={1000} rows={3} />
          <Button size="lg" loading={pending} disabled={pending} onClick={saveReturn}>Salvar retorno</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
