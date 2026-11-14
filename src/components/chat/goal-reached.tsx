"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { LiteAttention } from "@/components/lite/motion/attention";
import { saoPauloDayKey } from "@/components/motion/first-time-today/first-time-today-core";
import { useFirstTimeToday } from "@/components/motion/first-time-today/use-first-time-today";
import { fireFeedbackOnce } from "@/lib/feedback/use-feedback";

/** Mesma chave de "primeira vez hoje" e do limite diário para a meta do Início e a missão: um marco por dia. */
export const GOAL_REACHED_KEY = "meta-do-dia";

const PHRASES = {
  goal: ["Meta do dia batida.", "Bateu a meta de hoje.", "Meta batida. Bom trabalho."],
  mission: ["Missão do dia cumprida.", "Missão de hoje feita.", "Missão cumprida. Bom trabalho."],
} as const;

/** Dono do marco do dia nesta visita: se a meta e a missão batem juntas na mesma tela, só uma comemora. */
let owner: { day: string; id: string } | null = null;
const lastPhrase: Partial<Record<keyof typeof PHRASES, number>> = {};

function pickPhrase(kind: keyof typeof PHRASES) {
  const list = PHRASES[kind];
  let index = Math.floor(Math.random() * list.length);
  if (index === lastPhrase[kind]) index = (index + 1) % list.length;
  lastPhrase[kind] = index;
  return list[index];
}

/** Só para testes: esquece o dono do marco do dia. */
export function resetGoalReachedOwner() {
  owner = null;
}

/**
 * Meta batida (docs/design-system/FEEDBACK.md, nível 2): na primeira vez do dia em que a barra aparece cheia,
 * um anel único em volta dela, som `milestone` e vibração `success`, e um texto curto de colega. O limite
 * diário (`budgetKey: "meta-do-dia"`) e a "primeira vez hoje" garantem uma vez por dia; nas outras visitas a
 * barra só aparece cheia. Sem comemoração (desligada ou já usada), fica só o texto.
 */
export function GoalReached({ reached, kind, className, children }: {
  reached: boolean;
  kind: keyof typeof PHRASES;
  className?: string;
  children: ReactNode;
}) {
  if (!reached) return <>{children}</>;
  return <GoalReachedMoment kind={kind} className={className}>{children}</GoalReachedMoment>;
}

function GoalReachedMoment({ kind, className, children }: { kind: keyof typeof PHRASES; className?: string; children: ReactNode }) {
  const id = useId();
  // Montado só com a meta batida, então a "primeira vez hoje" só é gasta quando a meta bate.
  const first = useFirstTimeToday(`${GOAL_REACHED_KEY}-batida`);
  const [moment, setMoment] = useState<{ ring: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!first) return;
    const day = saoPauloDayKey(new Date());
    if (owner && owner.day === day && owner.id !== id) return;
    owner = { day, id };
    const plan = fireFeedbackOnce(`${GOAL_REACHED_KEY}:${day}`, "milestone", { budgetKey: GOAL_REACHED_KEY });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o marco é decidido no navegador, depois da hidratação
    setMoment({ ring: plan.celebrate, text: pickPhrase(kind) });
  }, [first, id, kind]);

  return (
    <>
      <LiteAttention pulseKey={moment?.ring ? "meta-batida" : undefined} className={className}>{children}</LiteAttention>
      {moment ? <span role="status" data-goal-reached="" className="block pt-1 text-xs font-medium text-(--foreground)">{moment.text}</span> : null}
    </>
  );
}
