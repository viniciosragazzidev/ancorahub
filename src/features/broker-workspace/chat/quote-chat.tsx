"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { ChatScreen } from "@/components/chat/chat-screen";
import type { ChatBlock, ChatScript } from "@/components/chat/types";
import { ASSISTANTS } from "./assistant-scripts";
import {
  applyQuoteChoice,
  chosenPlanBlocks,
  nextQuoteBlocks,
  parseAges,
  quoteAwaiting,
  quoteProgress,
  quoteResults,
  quoteSummaryText,
  resultBlocks,
  type QuoteAnswers,
} from "./quote-flow";

const INTRO: ChatBlock[] = [
  { type: "assistant", id: "a-intro", text: "Vamos montar uma cotação? São 6 perguntas rápidas e no fim eu te mostro os planos mais em conta." },
  ...nextQuoteBlocks({}),
];

/** The assistant Cotação: the quote simulator as a guided conversation. */
export function QuoteChat() {
  // "Refazer" starts a fresh conversation.
  const [run, setRun] = useState(0);
  return <QuoteConversation key={run} onRestart={() => setRun((value) => value + 1)} />;
}

function QuoteConversation({ onRestart }: { onRestart: () => void }) {
  const [answers, setAnswers] = useState<QuoteAnswers>({});
  const answersRef = useRef<QuoteAnswers>({});
  const chosenRef = useRef<string | null>(null);
  const round = useRef(0);
  const script = useMemo<ChatScript>(() => ({ blocks: INTRO, status: { label: "Montando a cotação", tone: "idle" } }), []);
  const definition = ASSISTANTS.cotacao;

  const commit = useCallback((next: QuoteAnswers) => {
    answersRef.current = next;
    setAnswers(next);
  }, []);

  const onLocalChoice = useCallback(async (_choice: unknown, value: string): Promise<ChatBlock[]> => {
    const current = answersRef.current;
    round.current += 1;
    const [field, raw] = value.split(":");
    if (field === "restart") {
      onRestart();
      return [];
    }
    if (field === "plan") {
      chosenRef.current = raw;
      return chosenPlanBlocks(current, raw, round.current);
    }
    if (field === "back") return resultBlocks(current, round.current);
    if (field === "send") {
      const result = quoteResults(current).find(({ plan }) => plan.id === chosenRef.current);
      if (!result) return [];
      const text = quoteSummaryText(current, result);
      const copied = await (navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false));
      return [{
        type: "assistant",
        id: `a-copied-${round.current}`,
        text: copied ? `Copiei o resumo: "${text}"` : `Não consegui copiar sozinho. Segura o texto para copiar: "${text}"`,
      }];
    }
    const next = applyQuoteChoice(current, value);
    if (!next) return [];
    commit(next);
    return nextQuoteBlocks(next);
  }, [commit, onRestart]);

  const onFreeText = useCallback(async (text: string): Promise<ChatBlock[]> => {
    const current = answersRef.current;
    round.current += 1;
    const waiting = quoteAwaiting(current);
    if (waiting === "entity") {
      const next = { ...current, entity: text.trim() };
      commit(next);
      return nextQuoteBlocks(next);
    }
    if (waiting === "ages") {
      const parsed = parseAges(text, current.profile);
      if ("error" in parsed) return [{ type: "assistant", id: `a-ages-error-${round.current}`, text: parsed.error }];
      const next = { ...current, ages: parsed.ages };
      commit(next);
      return nextQuoteBlocks(next);
    }
    return [{ type: "assistant", id: `a-free-${round.current}`, text: "Escolha uma das opções acima para seguir. Se quiser recomeçar, toque em Refazer." }];
  }, [commit]);

  const waiting = quoteAwaiting(answers);
  const placeholder = waiting === "ages"
    ? answers.profile === "individual" ? "Ex.: 35" : "Ex.: 35, 32, 8"
    : waiting === "entity" ? "Ex.: Advogado, OAB" : undefined;

  return (
    <div className="arc-venancor">
      <ChatScreen
        identity={{ name: definition.name, shape: definition.shape, hue: definition.hue }}
        backHref="/dashboard"
        script={script}
        onLocalChoice={onLocalChoice}
        onFreeText={onFreeText}
        progress={waiting === "done" ? null : quoteProgress(answers)}
        placeholder={placeholder}
        composerInput={waiting === "ages"
          ? { inputMode: "numeric", label: "Idades de quem vai entrar no plano, separadas por vírgula" }
          : waiting === "entity" ? { label: "Profissão e entidade de classe" } : undefined}
      />
    </div>
  );
}
