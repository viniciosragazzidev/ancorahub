"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Timer } from "lucide-react";

import { LiteAttention, LiteNumber, LiteProgress, LiteStagger, LiteSwap } from "@/components/lite/motion";
import { formatAbsoluteTime, formatAgo, formatCountdown } from "@/components/lite/status/format";
import { useCountdown, useNowSeconds } from "@/components/lite/status/use-countdown";

import type { NegotiationLevel } from "./negotiation-model";
import { NEGOTIATION_LIMITS } from "./negotiation-model";
import type { NegotiationLead, NegotiationsDashboardData } from "./queries";
import { enteredToday } from "./negotiation-stage-summary-model";
import styles from "./negotiations.module.css";

type SummaryFilter = NegotiationLevel | "customers_waiting";

const STAGES: Array<{ id: Extract<NegotiationLevel, "closing" | "advanced" | "in_conversation">; label: string; detail: string; icon: typeof CheckCircle2 }> = [
  { id: "in_conversation", label: "Em conversa", detail: "Trocas recentes entre cliente e corretor", icon: MessageCircle },
  { id: "advanced", label: "Negociação avançada", detail: "Sinais de proposta ou negociação", icon: Timer },
  { id: "closing", label: "Fechamento", detail: "Documentos e análise final", icon: CheckCircle2 },
];

function oldestWaiting(leads: readonly NegotiationLead[]) {
  return leads
    .filter((lead) => lead.customerWaiting && lead.lastCustomerMessageAt)
    .sort((left, right) => new Date(left.lastCustomerMessageAt!).getTime() - new Date(right.lastCustomerMessageAt!).getTime())[0] ?? null;
}

function oldestCooling(leads: readonly NegotiationLead[]) {
  return leads
    .filter((lead) => lead.level === "cooling" && lead.lastExchangeAt)
    .sort((left, right) => new Date(left.lastExchangeAt!).getTime() - new Date(right.lastExchangeAt!).getTime())[0] ?? null;
}

function countForLevel(data: NegotiationsDashboardData, level: NegotiationLevel) {
  return data.counts[level];
}

export function NegotiationStageSummary({ data, generatedAt, activeFilter, onFilter }: {
  data: NegotiationsDashboardData;
  generatedAt: Date;
  activeFilter: "all" | SummaryFilter;
  onFilter: (filter: SummaryFilter) => void;
}) {
  const waiting = useMemo(() => oldestWaiting(data.leads), [data.leads]);
  const cooling = useMemo(() => oldestCooling(data.leads), [data.leads]);
  const waitTarget = waiting?.lastCustomerMessageAt
    ? new Date(new Date(waiting.lastCustomerMessageAt).getTime() + NEGOTIATION_LIMITS.staleReplyHours * 60 * 60 * 1000).toISOString()
    : null;
  const remaining = useCountdown(waitTarget);
  const clockNow = useNowSeconds();
  const due = remaining !== null && remaining <= 0;
  const previousDue = useRef(false);
  const [duePulse, setDuePulse] = useState(0);
  const previousCounts = useRef(data.counts);
  const [countPulses, setCountPulses] = useState<Record<string, number>>({});

  useEffect(() => {
    if (due && !previousDue.current) setDuePulse((value) => value + 1);
    previousDue.current = due;
  }, [due]);

  useEffect(() => {
    const previous = previousCounts.current;
    setCountPulses((current) => {
      const next = { ...current };
      for (const key of Object.keys(data.counts) as Array<keyof NegotiationsDashboardData["counts"]>) {
        if (previous[key] !== data.counts[key]) next[key] = (next[key] ?? 0) + 1;
      }
      return next;
    });
    previousCounts.current = data.counts;
  }, [data.counts]);

  const now = clockNow ?? generatedAt.getTime();
  const targetText = waitTarget
    ? remaining === null ? formatAbsoluteTime(waitTarget, generatedAt.toISOString()) : due ? "Vencendo agora, reclassifica na próxima atualização" : `Reclassifica em ${formatCountdown(remaining)}`
    : "Sem resposta pendente";

  return (
    <section className={styles.stageSummary} aria-label="Negociações agora">
      <LiteStagger className={styles.stageCards}>
        {STAGES.map(({ id, label, detail, icon: Icon }) => {
          const count = countForLevel(data, id);
          const proportion = data.leads.length ? (count / data.leads.length) * 100 : 0;
          const entered = enteredToday(data.leads, id, generatedAt);
          const isActive = activeFilter === id;
          return (
            <button key={id} type="button" className={styles.stageCard} data-level={id} data-active={isActive || undefined} aria-pressed={isActive} onClick={() => onFilter(id)}>
              <span className={styles.stageCardTop}><Icon aria-hidden="true" size={18} /><span>{label}</span></span>
              <LiteAttention pulseKey={countPulses[id] || undefined} className={styles.stageCount}><LiteNumber value={count} countFromZero live /></LiteAttention>
              <span className={styles.stageDetail}>{entered} {entered === 1 ? "entrou" : "entraram"} na etapa atual hoje</span>
              <LiteProgress value={proportion} label={`${label}: proporção do total de atendimentos`} className={styles.stageProgress} />
              <span className={styles.srOnly}>{detail}</span>
            </button>
          );
        })}
        <article className={styles.attentionCard} aria-label="Faixas de atenção">
          <h2 className={styles.attentionTitle}><AlertTriangle aria-hidden="true" size={18} /> Atenção</h2>
          <div className={styles.attentionItems}>
            <div className={styles.attentionItem}>
              <button type="button" className={styles.attentionAction} data-active={activeFilter === "customers_waiting" || undefined} aria-pressed={activeFilter === "customers_waiting"} onClick={() => onFilter("customers_waiting")}>
                <span className={styles.attentionLabel}>Aguardando resposta</span>
                <LiteAttention pulseKey={countPulses.customers_waiting || undefined} className={styles.attentionValue}><LiteNumber value={data.counts.customers_waiting} countFromZero live /></LiteAttention>
                {waiting ? <span className={styles.attentionHint}>Mais antigo {formatAgo(now - new Date(waiting.lastCustomerMessageAt!).getTime())}</span> : <span className={styles.attentionHint}>{data.counts.customers_waiting ? "Sem data da última resposta" : "Sem espera pendente"}</span>}
              </button>
              {waitTarget ? (
                <LiteSwap swapKey={due ? "due" : "waiting"} className={styles.countdownSwap}>
                  <span className={styles.countdownLine}>
                    <LiteAttention pulseKey={duePulse || undefined} className={styles.countdownPulse}><span className={styles.countdownDot} aria-hidden="true" /></LiteAttention>
                    <span className={styles.countdown} role="timer" aria-live="off" aria-label={`Limite de espera ${formatAbsoluteTime(waitTarget, generatedAt.toISOString())}`}>{targetText}</span>
                  </span>
                </LiteSwap>
              ) : null}
            </div>
            <div className={styles.attentionItem}>
              <button type="button" className={styles.attentionAction} data-active={activeFilter === "cooling" || undefined} aria-pressed={activeFilter === "cooling"} onClick={() => onFilter("cooling")}>
                <span className={styles.attentionLabel}>Esfriando</span>
                <LiteAttention pulseKey={countPulses.cooling || undefined} className={styles.attentionValue}><LiteNumber value={data.counts.cooling} countFromZero live /></LiteAttention>
                {cooling ? <span className={styles.attentionHint}>Mais antigo parado {formatAgo(now - new Date(cooling.lastExchangeAt!).getTime())}</span> : <span className={styles.attentionHint}>{data.counts.cooling ? "Sem data da última troca" : "Nenhum parado"}</span>}
              </button>
            </div>
            {data.counts.no_crm_conversation > 0 ? (
              <div className={styles.attentionItem}>
                <button type="button" className={styles.attentionAction} data-active={activeFilter === "no_crm_conversation" || undefined} aria-pressed={activeFilter === "no_crm_conversation"} onClick={() => onFilter("no_crm_conversation")}>
                  <span className={styles.attentionLabel}>Sem conversa no CRM</span>
                  <LiteAttention pulseKey={countPulses.no_crm_conversation || undefined} className={styles.attentionValue}><LiteNumber value={data.counts.no_crm_conversation} countFromZero live /></LiteAttention>
                  <span className={styles.attentionHint}>Status avançado sem mensagem registrada</span>
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </LiteStagger>
    </section>
  );
}
