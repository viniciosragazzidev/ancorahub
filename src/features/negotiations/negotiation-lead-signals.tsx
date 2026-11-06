"use client";

import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";

import { formatAgo } from "@/components/lite/status/format";
import { intentLabel, stageLabel } from "@/features/conversation-intelligence/components/radar-model";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import type { NegotiationLead } from "./queries";
import { LEVEL_LABELS } from "./negotiations-data-views";
import { negotiationSignalTags, replyOwedLabel } from "./negotiation-lead-row";
import { formatBusinessMinutes, waitingStepText } from "./negotiation-waiting-panel";
import styles from "./negotiations.module.css";

const TRAIL = [
  { id: "in_conversation", label: "Em conversa" },
  { id: "advanced", label: "Negociação avançada" },
  { id: "closing", label: "Fechamento" },
] as const;

function ago(value: string | null, now: Date) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? formatAgo(now.getTime() - time) : null;
}

/** Trilha de etapas do atendimento: as etapas já passadas ficam marcadas até a atual. */
export function NegotiationLeadTrail({ lead }: { lead: NegotiationLead }) {
  const currentIndex = TRAIL.findIndex(({ id }) => id === lead.level);
  return (
    <section className={styles.miniTrail} aria-label="Etapas comerciais">
      <ol>
        {TRAIL.map((stage, index) => (
          <li key={stage.id} data-level={stage.id} data-current={index === currentIndex || undefined} data-done={currentIndex > index || undefined} aria-current={index === currentIndex ? "step" : undefined}>
            <span>{stage.label}</span>
          </li>
        ))}
      </ol>
      {currentIndex < 0 ? <p>Nível atual: {LEVEL_LABELS[lead.level]}</p> : null}
    </section>
  );
}

/** Situação do atendimento hoje: o que o CRM e as mensagens dizem, sem a leitura da IA. */
export function NegotiationLeadSituation({ lead, now }: { lead: NegotiationLead; now: Date }) {
  const tags = negotiationSignalTags(lead).filter((tag) => tag !== "IA indica próxima etapa");
  const lastExchange = ago(lead.lastExchangeAt, now);
  const atStage = ago(lead.stageEnteredAt, now);
  return (
    <section className={styles.drawerSection} aria-labelledby="negotiation-situation-title">
      <h3 className={styles.drawerTitle} id="negotiation-situation-title">Situação</h3>
      <dl className={styles.facts}>
        <div><dt>Etapa no CRM</dt><dd>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}{atStage ? <span className={styles.factHint}> · {atStage}</span> : null}</dd></div>
        <div><dt>Agora</dt><dd data-tone={lead.customerWaiting ? "waiting" : undefined}>{replyOwedLabel(lead)}</dd></div>
        <div><dt>Última troca</dt><dd>{lastExchange ?? "Sem troca recente"}</dd></div>
        {lead.waiting ? <div><dt>Espera do cliente</dt><dd data-tone="waiting">{formatBusinessMinutes(lead.waiting.waitingBusinessMinutes)} úteis<span className={styles.factHint}> · {waitingStepText(lead.waiting)} (observação)</span></dd></div> : null}
        <div><dt>Corretor</dt><dd>{lead.brokerName}{lead.branchName ? <span className={styles.factHint}> · {lead.branchName}</span> : null}</dd></div>
      </dl>
      {tags.length ? <div className={styles.tagRow}>{tags.map((tag) => <span key={tag} className={styles.signalTag}>{tag}</span>)}</div> : null}
    </section>
  );
}

const ATTENTION_LABEL = { ACT: "Precisa da direção", WATCH: "Acompanhar", NONE: "Bem encaminhado" } as const;

/**
 * Leitura da IA para quem gerencia (06/11): primeiro o que a direção precisa saber e fazer;
 * o próximo passo do corretor fica abaixo, como informação. Análises antigas (sem a leitura
 * para a direção) mostram o resumo no topo até a próxima análise da conversa.
 */
export function NegotiationLeadAi({ lead, now }: { lead: NegotiationLead; now: Date }) {
  const { ai } = lead;
  const analyzed = ago(ai.lastAnalyzedAt, now);
  return (
    <section className={styles.drawerSection} aria-labelledby="negotiation-ai-title">
      <div className={styles.aiHead}>
        <h3 className={styles.drawerTitle} id="negotiation-ai-title"><Sparkles aria-hidden="true" size={16} /> Leitura da IA</h3>
        {analyzed ? <span className={styles.factHint}>Analisado {analyzed}</span> : null}
      </div>

      <div className={styles.aiNext}>
        <span className={styles.aiLabel}><ArrowRight aria-hidden="true" size={14} /> Para a direção</span>
        <p>{ai.directorBrief ?? ai.summary ?? "A IA ainda não analisou este atendimento."}</p>
        {!ai.directorBrief && ai.summary ? <span className={styles.factHint}>A leitura para a direção sai na próxima análise desta conversa.</span> : null}
      </div>

      {ai.directorAttention && ai.directorAttention !== "NONE" && ai.directorAction ? (
        <div className={styles.aiRisk} role="note" data-attention={ai.directorAttention}>
          <span className={styles.aiLabel}><AlertTriangle aria-hidden="true" size={14} /> {ATTENTION_LABEL[ai.directorAttention]}</span>
          <p>{ai.directorAction}</p>
        </div>
      ) : ai.directorAttention === "NONE" ? (
        <p className={styles.factHint}>{ATTENTION_LABEL.NONE}: sem ação da direção agora.</p>
      ) : null}

      {lead.statusBehindAi ? <p className={styles.statusBehind}>A IA indica uma etapa à frente do CRM. O status não foi alterado.</p> : null}

      {ai.directorBrief && ai.summary ? (
        <div className={styles.aiBlock}>
          <span className={styles.aiLabel}>Resumo da conversa</span>
          <p>{ai.summary}</p>
        </div>
      ) : null}

      {ai.nextBestAction ? (
        <div className={styles.aiBlock}>
          <span className={styles.aiLabel}>Próximo passo do corretor</span>
          <p>{ai.nextBestAction}</p>
        </div>
      ) : null}

      <div className={styles.aiPair}>
        <div className={styles.aiBlock}>
          <span className={styles.aiLabel}>Intenção do cliente</span>
          <p>{intentLabel[ai.customerIntent] ?? "Pendente"}</p>
        </div>
        <div className={styles.aiBlock}>
          <span className={styles.aiLabel}>Etapa pela IA</span>
          <p>{stageLabel[ai.conversationStage] ?? "Em análise"}</p>
        </div>
      </div>

      {ai.buyingSignals.length ? (
        <div className={styles.aiBlock}>
          <span className={styles.aiLabel}>Sinais de compra ({ai.buyingSignals.length})</span>
          <ul className={styles.aiList} data-tone="positive">{ai.buyingSignals.map((signal, index) => <li key={`${index}-${signal}`}>{signal}</li>)}</ul>
        </div>
      ) : null}

      {ai.objections.length ? (
        <div className={styles.aiBlock}>
          <span className={styles.aiLabel}>Objeções ({ai.objections.length})</span>
          <ul className={styles.aiList} data-tone="objection">{ai.objections.map((objection, index) => <li key={`${index}-${objection}`}>{objection}</li>)}</ul>
        </div>
      ) : null}

      {ai.risk ? (
        <div className={styles.aiRisk} role="note">
          <span className={styles.aiLabel}><AlertTriangle aria-hidden="true" size={14} /> Risco</span>
          <p>{ai.risk}</p>
        </div>
      ) : null}
    </section>
  );
}
