"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { agendarRetornoAction, reagendarRetornoAction } from "@/features/carteira/retorno-actions";
import type { NextActionView } from "@/features/carteira/proxima-acao-core";
import { setLeadTaskDoneAction } from "@/features/leads/task-actions";

import styles from "./light-client-detail.module.css";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Valor do campo datetime-local (horário de São Paulo, sem fuso) para o formato com o fuso fixo -03:00. */
export function localInputToSaoPauloIso(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return null;
  return `${trimmed}:00-03:00`;
}

/** Converte um instante para o valor do campo datetime-local em São Paulo, para pré-preencher o reagendamento. */
export function instantToSaoPauloInput(iso: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Próxima ação da ficha do corretor (C2). Sem pendência diz que não há retorno agendado; nunca "em dia".
 * WhatsApp não aparece aqui como contato concluído: só o retorno é registrado.
 */
export function LightNextActionPanel({ clientId, leadId, nextAction }: { clientId: string; leadId: string; nextAction: NextActionView | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<null | "agendar" | "reagendar">(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function openSheet(kind: "agendar" | "reagendar") {
    setError(null);
    setFeedback(null);
    if (kind === "reagendar" && nextAction?.dueAt) setDraftDate(instantToSaoPauloInput(nextAction.dueAt));
    setSheet(kind);
  }

  function save() {
    setError(null);
    const dueAt = localInputToSaoPauloIso(draftDate);
    if (!dueAt) {
      setError("Escolha a data e a hora do retorno.");
      return;
    }
    startTransition(async () => {
      const result = sheet === "reagendar" && nextAction?.taskId
        ? await reagendarRetornoAction({ taskId: nextAction.taskId, clientId, dueAt })
        : await agendarRetornoAction({ leadId, clientId, dueAt, note: draftNote || null });
      if (!result.ok) {
        // Erro mantém data e observação digitadas.
        setError(result.error);
        return;
      }
      const repeated = "repeated" in result && result.repeated === true;
      setSheet(null);
      setDraftDate("");
      setDraftNote("");
      setFeedback(sheet === "reagendar" ? "Retorno reagendado." : repeated ? "Este retorno já estava agendado." : "Retorno agendado.");
      router.refresh();
    });
  }

  function concluir() {
    if (!nextAction?.taskId) return;
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await setLeadTaskDoneAction(nextAction.taskId!, "done");
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedback("Retorno concluído.");
      router.refresh();
    });
  }

  const title = sheet === "reagendar" ? "Reagendar retorno" : "Agendar retorno";

  return (
    <section className={styles.panel} aria-labelledby="client-next-action-title">
      <h2 id="client-next-action-title">Próxima ação</h2>
      {nextAction === null ? (
        <>
          <p role="alert" className={styles.empty}>Não foi possível carregar o retorno agora.</p>
          <Button variant="secondary" onClick={() => router.refresh()}>Tentar de novo</Button>
        </>
      ) : nextAction.state === "none" ? (
        <>
          <p className={styles.empty}>{nextAction.reason}</p>
          <Button variant="primary" onClick={() => openSheet("agendar")}>Agendar retorno</Button>
        </>
      ) : (
        <>
          <div>
            <p><strong>{nextAction.title ?? "Retorno"}</strong></p>
            <p className={styles.empty}>{nextAction.reason}{nextAction.dueAt ? ` · ${dateTimeFormat.format(new Date(nextAction.dueAt))}` : ""}</p>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" loading={pending} disabled={pending} onClick={concluir}>Já falei</Button>
            <Button variant="secondary" disabled={pending} onClick={() => openSheet("reagendar")}>Reagendar</Button>
          </div>
        </>
      )}
      {feedback ? <p role="status" className={styles.empty}>{feedback}</p> : null}
      {error && sheet === null ? <p role="alert" className={styles.empty}>{error}</p> : null}

      <BottomSheet
        open={sheet !== null}
        onOpenChange={(open) => setSheet(open ? sheet : null)}
        title={title}
        description="Data e hora em horário de São Paulo."
        detents={[0.7]}
        closeLabel="Fechar"
        className="arc-venancor"
      >
        <div className={styles.sheetActions}>
          <label className={styles.empty}>
            Quando
            <input type="datetime-local" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} required />
          </label>
          {sheet === "agendar" ? (
            <label className={styles.empty}>
              Observação (opcional)
              <textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} maxLength={1000} rows={3} />
            </label>
          ) : null}
          {error ? <p role="alert" className={styles.empty}>{error}</p> : null}
          <Button size="lg" loading={pending} disabled={pending} onClick={save}>Salvar retorno</Button>
        </div>
      </BottomSheet>
    </section>
  );
}
