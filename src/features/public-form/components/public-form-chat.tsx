"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { ChatScreen } from "@/components/chat/chat-screen";
import type { ChatBlock, ChatChoice, ChatScript } from "@/components/chat/types";
import { newClientMessageId } from "@/components/chat/user-send-core";
import { LiteSuccess } from "@/components/lite/motion";
import { useDevLab } from "@/lib/dev-lab";
import { useFeedback } from "@/lib/feedback/use-feedback";

import {
  applyFormChoice,
  applyFormText,
  composerFor,
  formatMobile,
  formAwaiting,
  formProgress,
  introBlocks,
  nextFormBlocks,
  splitFormChoice,
  toSubmission,
  type FormAnswers,
  type PublicFormResult,
  type PublicFormSubmission,
} from "../form-flow";
import styles from "./public-form-chat.module.css";

/** O que a conversa pede ao servidor; o laboratório (/dev/laboratorio) troca por respostas simuladas. */
export type PublicFormServices = { submit: (submission: PublicFormSubmission) => Promise<PublicFormResult> };

const identity = { name: "Âncora Saúde", shape: "logo" as const, hue: null };

async function postSubmission(submission: PublicFormSubmission): Promise<PublicFormResult> {
  try {
    const response = await fetch("/api/public/formulario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string; retryable?: boolean } | null;
    if (response.ok && payload?.ok) return { ok: true };
    return { ok: false, error: payload?.error ?? "Não consegui enviar agora. Suas respostas continuam aqui.", retryable: payload?.retryable ?? true };
  } catch {
    return { ok: false, error: "Sem conexão. Confira a internet; suas respostas continuam aqui.", retryable: true };
  }
}

/**
 * Formulário público de qualificação (/formulario, 23/11/2026): a conversa passo a passo do Lite (a
 * mesma ChatScreen da Cotação e da venda), sem login. Até 7 perguntas, opções para tocar e o WhatsApp no
 * fim. O "enviado" só aparece depois que o servidor confirma; a falha mantém as respostas e oferece
 * "Tentar de novo" com a mesma chave (nunca cria dois leads).
 */
export function PublicFormChat({ services }: { services?: PublicFormServices }) {
  const [run, setRun] = useState(0);
  return <PublicFormConversation key={run} services={services} onRestart={() => setRun((value) => value + 1)} />;
}

function PublicFormConversation({ services, onRestart }: { services?: PublicFormServices; onRestart: () => void }) {
  const lab = useDevLab();
  const submit = services?.submit ?? lab?.publicForm?.submit ?? postSubmission;
  const fire = useFeedback();
  const [answers, setAnswers] = useState<FormAnswers>({});
  const answersRef = useRef<FormAnswers>({});
  const round = useRef(0);
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState(false);
  const sentRef = useRef(false);

  const script = useMemo<ChatScript>(() => ({ status: { label: "Esperando você", tone: "waiting" }, blocks: introBlocks() }), []);

  const commit = useCallback((next: FormAnswers) => {
    answersRef.current = next;
    setAnswers(next);
  }, []);

  const send = useCallback(async (current: FormAnswers): Promise<ChatBlock[]> => {
    const turn = ++round.current;
    // A mesma conversa reenviada usa a mesma chave; mudou a resposta (outro número), chave nova.
    const draft = toSubmission(current, attempt.current?.key ?? newClientMessageId(), honeypot.current?.value ?? "");
    if (!draft) return nextFormBlocks({ ...current, confirmed: false }, turn);
    const body = JSON.stringify({ ...draft, idempotencyKey: "" });
    const key = attempt.current && attempt.current.body === body ? attempt.current.key : newClientMessageId();
    attempt.current = { key, body };
    const result = await submit({ ...draft, idempotencyKey: key });
    if (!result.ok) {
      fire("error");
      commit({ ...current, confirmed: false });
      return [
        { type: "assistant", id: `a-error-${turn}`, text: /respostas continuam aqui/i.test(result.error) ? result.error : `${result.error} Suas respostas continuam aqui.` },
        {
          type: "question", id: `q-retry-${turn}`, prompt: "Como quer seguir?",
          choices: [
            { id: "retry", label: "Tentar de novo", action: { kind: "local", value: "confirm:1" } },
            { id: "fix", label: "Corrigir o número", action: { kind: "local", value: "fixPhone:1" } },
          ],
        },
      ];
    }
    // Enviar o formulário é nível 1 (FEEDBACK.md), e raro para quem envia: confirmação com som discreto.
    fire("confirm", { sound: true });
    sentRef.current = true;
    setSent(true);
    const first = current.name?.split(" ")[0] ?? "";
    return [{
      type: "custom", id: `done-${turn}`, kind: "done",
      data: { text: `Obrigado, ${first}. Um corretor da Âncora vai te chamar no WhatsApp ${formatMobile(current.phone!)} em breve.` },
    }];
  }, [commit, fire, submit]);

  const onLocalChoice = useCallback(async (_choice: ChatChoice, value: string): Promise<ChatBlock[]> => {
    if (sentRef.current) return [];
    const current = answersRef.current;
    const [field] = splitFormChoice(value);
    if (field === "restart") { onRestart(); return []; }
    // "Tentar de novo" depois de uma falha é a mesma confirmação (a falha devolve a conversa para ela).
    const next = applyFormChoice(current, value);
    if (!next) return [];
    commit(next);
    if (formAwaiting(next) === "done") {
      fire("tap");
      return send(next);
    }
    return nextFormBlocks(next, ++round.current);
  }, [commit, fire, onRestart, send]);

  const onFreeText = useCallback(async (text: string): Promise<ChatBlock[]> => {
    const turn = ++round.current;
    if (sentRef.current) return [{ type: "assistant", id: `a-after-${turn}`, text: "Suas respostas já foram enviadas. O corretor vai te chamar no WhatsApp." }];
    const outcome = applyFormText(answersRef.current, text);
    if ("error" in outcome) return [{ type: "assistant", id: `a-text-error-${turn}`, text: outcome.error }];
    commit(outcome.answers);
    return nextFormBlocks(outcome.answers, turn);
  }, [commit]);

  const localWorkingLabel = useCallback((value: string) => {
    const [field] = splitFormChoice(value);
    return field === "confirm" ? "Enviando suas respostas…" : null;
  }, []);

  const renderCustom = useCallback((block: Extract<ChatBlock, { type: "custom" }>) => {
    if (block.kind !== "done") return null;
    const data = block.data as { text: string };
    return (
      <section className={styles.done} aria-label="Respostas enviadas">
        <LiteSuccess label="Respostas enviadas" className={styles.doneTitle} />
        <p className={styles.doneText}>{data.text}</p>
      </section>
    );
  }, []);

  const awaiting = formAwaiting(answers);
  // "Respostas enviadas" só depois que o servidor confirma; antes disso, o envio está em andamento.
  const composer = sent ? composerFor({ ...answers, confirmed: true }) : awaiting === "done" ? { placeholder: "Enviando suas respostas…", input: undefined } : composerFor(answers);

  return (
    <div className={`arc-venancor ${styles.root}`}>
      <ChatScreen
        identity={identity}
        backHref="/formulario"
        backButton={false}
        mentions={false}
        script={script}
        onLocalChoice={onLocalChoice}
        onFreeText={onFreeText}
        localWorkingLabel={localWorkingLabel}
        renderCustom={renderCustom}
        closePassedQuestions
        composerDisabled={sent}
        progress={sent || awaiting === "confirm" || awaiting === "done" ? null : formProgress(answers)}
        placeholder={composer.placeholder}
        composerInput={composer.input}
      />
      {/* Honeypot: fora da vista e do teclado; quem preenche é robô e o envio é descartado no servidor. */}
      <label className={styles.trap} aria-hidden="true">
        Site
        <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
