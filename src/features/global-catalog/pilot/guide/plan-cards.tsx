"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { LiteSuccess } from "@/components/lite/motion";
import type { CustomBlockApi } from "@/components/chat/chat-screen";

import type { QuoteResult } from "../contracts";
import styles from "./quote-guide.module.css";

export const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const count = (value: number) => value.toLocaleString("pt-BR");

/** Dados do bloco "plans" (JSON simples, a conversa compara blocos por JSON). */
export type PlansBlockData = {
  /** 0 no primeiro resultado; os "ver mais" continuam a contagem do ranking. */
  offset: number;
  plans: QuoteResult[];
  /** Resumo só no primeiro bloco de cada busca. */
  summary?: { total: number; ready: number; pending: number; catalog: number; modalityPlans: number; modalityLabel: string; profile: string; cheapestCents: number | null };
};
export type CelebrateBlockData = { title: string; text: string };

/** O que os cartões fazem: marcar para comparar e abrir condições ou rede. A tela fornece. */
export type QuoteGuideActions = {
  selected: string[];
  toggle: (plan: QuoteResult) => void;
  open: (plan: QuoteResult, tab: "conditions" | "network") => void;
  canExport: boolean;
};
export const QuoteGuideContext = createContext<QuoteGuideActions | null>(null);

/** Conta de 0 até o valor (dinheiro e contagens), uma vez, com mola suave. */
function useCountUp(target: number, delay = 0) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, target, { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1], onUpdate: (latest) => setValue(latest) });
    return () => controls.stop();
  }, [delay, reduce, target]);
  return reduce ? target : value;
}

function Counter({ value, format, delay }: { value: number; format: (value: number) => string; delay?: number }) {
  const shown = useCountUp(value, delay);
  return <>{format(Math.round(shown))}</>;
}

const SPARKS = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  return { x: Math.cos(angle) * 34, y: Math.sin(angle) * 20 };
});

/** "Menor preço" com um estouro de brilhos ao chegar. */
function BestBadge({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span className={styles.best} initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", visualDuration: 0.35, bounce: 0.45, delay }}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 1.5 9.6 6l4.4.4-3.4 2.9 1 4.4L8 11.4l-3.6 2.3 1-4.4L2 6.4 6.4 6Z" fill="currentColor" /></svg>
      Menor preço
      {reduce ? null : SPARKS.map((spark, index) => (
        <motion.span key={index} className={styles.spark} aria-hidden="true" initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }} animate={{ x: spark.x, y: spark.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }} transition={{ duration: 0.7, delay: delay + 0.15, ease: "easeOut" }} />
      ))}
    </motion.span>
  );
}

/** "GRUPO DE MUNICÍPIOS RJ" → "Grupo de municípios RJ" (a sigla do estado fica em maiúsculas). */
export function coverageLabel(value: string) {
  if (!value) return "";
  return value.toLocaleLowerCase("pt-BR").replace(/^./, (c) => c.toUpperCase()).replace(/(^|\s)(rj|sp|mg|es)(?=\s|$)/g, (code) => code.toUpperCase());
}

const STATE_LABEL: Record<QuoteResult["state"], string> = { ready: "Pronto para proposta", pending: "Conferir antes", incompatible: "Fora do perfil" };

function Chevron() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Fold({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div className={styles.fold}>
      <button type="button" className={styles.foldButton} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {label}
        <Chevron />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div className={styles.foldBody} initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function PlanCard({ plan, rank, index, api }: { plan: QuoteResult; rank: number; index: number; api: CustomBlockApi }) {
  const actions = useContext(QuoteGuideContext);
  const reduce = useReducedMotion();
  const selected = actions?.selected.includes(plan.id) ?? false;
  const full = (actions?.selected.length ?? 0) >= 3 && !selected;
  const delay = 0.08 + index * 0.09;
  const lives = plan.perLife.length;
  return (
    <motion.article
      className={styles.card}
      data-best={rank === 1}
      data-selected={selected}
      aria-label={`${rank}º ${plan.name}, ${money(plan.totalCents)} por mês`}
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", visualDuration: 0.42, bounce: 0.18, delay }}
    >
      <div className={styles.cardTop}>
        <span className={styles.rank}>
          <span className={styles.medal} data-first={rank === 1}>{rank}º</span>
          {rank === 1 ? <BestBadge delay={delay + 0.2} /> : null}
        </span>
        <span className={styles.state} data-state={plan.state}>{STATE_LABEL[plan.state]}</span>
      </div>
      <div>
        <p className={styles.who}>{[plan.operator, plan.administrator].filter(Boolean).join(" · ")}</p>
        <h3 className={styles.name}>{plan.name}</h3>
      </div>
      <div className={styles.chips}>
        {[plan.accommodation, plan.coparticipation, coverageLabel(plan.coverage)].filter(Boolean).map((chip) => <span key={chip} className={styles.chip}>{chip}</span>)}
      </div>
      <div className={styles.price}>
        <span className={styles.priceValue}><Counter value={plan.totalCents} format={money} delay={delay} /><span className={styles.priceUnit}>/mês</span></span>
        <span className={styles.perLife}>{lives > 1 ? `${lives} vidas · média ${money(Math.round(plan.totalCents / lives))}` : "1 vida"}</span>
      </div>
      {lives > 1 ? (
        <Fold label="Valor de cada vida">
          <ul className={styles.lifeList}>
            {plan.perLife.map((life, position) => <li key={position}><span>{life.holder ? "Titular" : `Dependente ${position}`} · {life.age} anos</span><span>{money(life.cents)}</span></li>)}
          </ul>
        </Fold>
      ) : null}
      {plan.reasons.length ? (
        <Fold label={`${plan.reasons.length} ${plan.reasons.length === 1 ? "ponto" : "pontos"} para conferir`}>
          <ul className={styles.reasonList}>
            {plan.reasons.map((reason) => <li key={reason}><span className={styles.reasonDot} aria-hidden="true" />{reason}</li>)}
          </ul>
        </Fold>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => actions?.open(plan, "conditions")}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h5.5L12 5v8.5H4Z M9.5 2.5V5H12 M6 8h4 M6 10.5h4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
          Condições
        </button>
        <button type="button" className={styles.action} onClick={() => actions?.open(plan, "network")}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14Z" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="6.5" r="1.6" fill="currentColor" /></svg>
          Rede {plan.networkCount ? `(${count(plan.networkCount)})` : ""}
        </button>
        <button type="button" className={styles.action} aria-pressed={selected} disabled={full} onClick={() => actions?.toggle(plan)}>
          <motion.span className={styles.check} data-on={selected} animate={reduce ? undefined : { scale: selected ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.28 }} aria-hidden="true">
            {selected ? <svg viewBox="0 0 12 12"><path d="m2.5 6.2 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
          </motion.span>
          Comparar
        </button>
      </div>
      {plan.state === "ready" && actions?.canExport ? (
        <button type="button" className={`${styles.action} ${styles.primary}`} onClick={() => api.local("Gerar a proposta em PDF", `pdf:${plan.id}`, `Gerar a proposta do ${plan.name}`)}>
          Gerar proposta em PDF
        </button>
      ) : plan.state !== "ready" ? (
        <p className={styles.locked}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
          Proposta em PDF e envio ao cliente liberam depois da revisão comercial deste plano.
        </p>
      ) : null}
    </motion.article>
  );
}

/** O resultado: resumo com números que sobem e o pódio dos mais em conta. */
export function PlansBlock({ data, api, mascot }: { data: PlansBlockData; api: CustomBlockApi; mascot: { shape: Parameters<typeof AssistantAvatar>[0]["shape"]; hue: number | null } }) {
  const reduce = useReducedMotion();
  const summary = data.summary;
  return (
    <section className={styles.results} aria-label="Planos encontrados">
      {summary ? (
        <motion.div className={styles.summary} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
          <div className={styles.summaryHead}>
            <motion.span animate={reduce ? undefined : { rotate: [0, -10, 10, -6, 0], y: [0, -4, 0] }} transition={{ duration: 0.7, delay: 0.3 }}>
              <AssistantAvatar shape={mascot.shape} hue={mascot.hue} size={40} />
            </motion.span>
            <div>
              <p className={styles.summaryTitle}>{summary.total ? `Achei ${count(summary.total)} ${summary.total === 1 ? "plano" : "planos"}` : "Nenhum plano neste perfil"}</p>
              <p className={styles.summarySub}>{summary.profile}</p>
            </div>
          </div>
          <div className={styles.funnel}>
            <span><strong><Counter value={summary.catalog} format={count} /></strong> no catálogo</span>
            <span className={styles.funnelArrow} aria-hidden="true">→</span>
            <span><strong><Counter value={summary.modalityPlans} format={count} delay={0.15} /></strong> de {summary.modalityLabel.toLocaleLowerCase("pt-BR")}</span>
            <span className={styles.funnelArrow} aria-hidden="true">→</span>
            <span><strong><Counter value={summary.total} format={count} delay={0.3} /></strong> para este perfil</span>
          </div>
          {summary.total ? (
            <div className={styles.tiles}>
              <div className={styles.tile}><span className={styles.tileValue} data-tone="action">{summary.cheapestCents !== null ? <Counter value={summary.cheapestCents} format={money} delay={0.35} /> : "Sem preço"}</span><span className={styles.tileLabel}>A partir de</span></div>
              <div className={styles.tile}><span className={styles.tileValue}><Counter value={summary.ready} format={count} delay={0.45} /></span><span className={styles.tileLabel}>Prontos para proposta</span></div>
              <div className={styles.tile}><span className={styles.tileValue}><Counter value={summary.pending} format={count} delay={0.55} /></span><span className={styles.tileLabel}>Para conferir</span></div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
      {data.plans.length ? (
        <div className={styles.cards}>
          {data.plans.map((plan, index) => <PlanCard key={plan.id} plan={plan} rank={data.offset + index + 1} index={index} api={api} />)}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Proposta pronta: confirmação discreta de nível 1 (FEEDBACK.md). Gerar proposta acontece dezenas de vezes por
 * dia, então não tem confete nem mascote pulando: o check se desenha ao lado do título e o resumo vem embaixo.
 * O bloco "celebrate" mantém o nome por compatibilidade com conversas já salvas.
 */
export function CelebrateBlock({ data, mascot }: { data: CelebrateBlockData; mascot: { shape: Parameters<typeof AssistantAvatar>[0]["shape"]; hue: number | null } }) {
  return (
    <section className={styles.celebrate} aria-label={data.title}>
      <AssistantAvatar shape={mascot.shape} hue={mascot.hue} size={40} />
      <LiteSuccess label={data.title} className={styles.celebrateTitle} />
      <p className={styles.celebrateText}>{data.text}</p>
    </section>
  );
}
