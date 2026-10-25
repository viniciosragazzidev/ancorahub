"use client";

/**
 * Aba "Prompt e comportamento" do hub de qualificação no visual Lite: números do dia, status e pausa da IA, tempo
 * limite, identidade e o prompt de contexto. Os campos são controlados pelo hub (o mesmo salvar da tela atual).
 */
import { Switch } from "@/components/arc/switch/switch";
import { LiteSelect } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import type { QualificationStatsSummary } from "@/features/ai-qualification/stats-service";

import styles from "./qualification-lite.module.css";

const PAUSE_OPTIONS = [
  { value: "handoff_active", label: "Transferir ativas para corretores (recomendado)" },
  { value: "finish_active", label: "Concluir conversas já iniciadas" },
  { value: "pause_immediately", label: "Pausar imediatamente todas as conversas" },
];

export type OverviewFields = {
  enabled: boolean;
  pauseMode: string;
  timeoutMinutes: number;
  assistantName: string;
  initialMessage: string;
  businessContext: string;
  customInstructions: string;
};

function brl(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

export function OverviewTabLite({ stats, fields, onChange, onToggleEnabled }: {
  stats: QualificationStatsSummary;
  fields: OverviewFields;
  onChange: (patch: Partial<OverviewFields>) => void;
  onToggleEnabled: (value: boolean) => void;
}) {
  const numbers = [
    { label: "Leads atendidos", value: stats.operation.startedToday, hint: `${stats.operation.active} ativos · ${stats.operation.transferredToHuman} passados a humano` },
    { label: "Qualificados", value: stats.qualification.totalQualified, hint: `${stats.qualification.hotLeads} quentes · ${stats.qualification.completionRatePct}% de conclusão` },
    { label: "Fila de espera", value: stats.distribution.waitingQueue, hint: `${stats.distribution.waitingQueue} em fila` },
    { label: "Custo de operação", value: brl(stats.costs.aiCostBrl + stats.costs.whatsappCostBrl), hint: `${brl(stats.costs.avgCostPerSessionBrl)} por atendimento` },
    { label: "Follow-ups", value: `${stats.followup.sent} enviados`, hint: `${stats.followup.conversionsPostFollowup} recuperados depois do follow-up` },
  ];
  return (
    <>
      <div className={page.stats}>
        {numbers.map((item) => (
          <div key={item.label} className={page.stat}>
            <span className={page.statLabel}>{item.label}</span>
            <span className={page.statValue}>{item.value}</span>
            <span className={page.statHint}>{item.hint}</span>
          </div>
        ))}
      </div>
      <div className={styles.columns}>
        <section className={sections.group} aria-labelledby="ai-status-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="ai-status-title" className={sections.rowTitle}>Operação da IA de qualificação</h2>
              <p className={sections.rowDescription}>{fields.enabled ? "O robô responde os novos atendimentos pelo WhatsApp." : "Automação pausada. As mensagens vão direto para a fila humana."}</p>
            </div>
            <span style={{ display: "inline-grid", placeItems: "center", minWidth: 44, minHeight: 44 }}>
              <Switch aria-labelledby="ai-status-title" checked={fields.enabled} onCheckedChange={(value) => onToggleEnabled(Boolean(value))} />
            </span>
          </div>
          <div className={sections.formBody}>
            <LiteSelect label="Modo de pausa" value={fields.pauseMode} options={PAUSE_OPTIONS} onChange={(value) => onChange({ pauseMode: value })} />
            <label className={form.field}>
              <span className={form.label}>Tempo limite sem resposta (minutos)</span>
              <input className={form.input} type="number" min={5} max={120} value={fields.timeoutMinutes} placeholder="20" onChange={(event) => onChange({ timeoutMinutes: Number(event.target.value) })} />
              <span className={form.hint}>Depois de {fields.timeoutMinutes} minutos sem resposta, a qualificação por IA termina, o lead fica como frio e vai direto para a fila de distribuição dos corretores.</span>
            </label>
          </div>
        </section>
        <section className={sections.group} aria-labelledby="ai-identity-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="ai-identity-title" className={sections.rowTitle}>Identidade do assistente</h2>
              <p className={sections.rowDescription}>Nome exibido e mensagem inicial de acolhimento.</p>
            </div>
          </div>
          <div className={sections.formBody}>
            <label className={form.field}>
              <span className={form.label}>Nome de exibição</span>
              <input className={form.input} value={fields.assistantName} placeholder="Ex.: assistente virtual Âncora" onChange={(event) => onChange({ assistantName: event.target.value })} />
            </label>
            <label className={form.field}>
              <span className={form.label}>Mensagem inicial</span>
              <textarea className={form.textarea} rows={3} value={fields.initialMessage} onChange={(event) => onChange({ initialMessage: event.target.value })} />
            </label>
          </div>
        </section>
        <section className={`${sections.group} ${styles.wide}`} aria-labelledby="ai-context-title">
          <div className={sections.row}>
            <div className={sections.rowText}>
              <h2 id="ai-context-title" className={sections.rowTitle}>Conhecimento e diretrizes da empresa</h2>
              <p className={sections.rowDescription}>A base de conhecimento, os planos vendidos e as regras de conduta que fundamentam o atendimento da IA. Salve pelo botão do topo.</p>
            </div>
          </div>
          <div className={sections.formBody}>
            <label className={form.field}>
              <span className={form.label}>Base de conhecimento (informações e produtos)</span>
              <textarea className={form.textarea} rows={4} value={fields.businessContext} placeholder="Ex.: corretora especialista em planos individuais, familiares e PME..." onChange={(event) => onChange({ businessContext: event.target.value })} />
              <span className={form.hint}>A IA usa estas informações para esclarecer as dúvidas do cliente.</span>
            </label>
            <label className={form.field}>
              <span className={form.label}>Diretrizes de atuação e tom de voz</span>
              <textarea className={form.textarea} rows={4} value={fields.customInstructions} placeholder="Ex.: seja cordial, empático e objetivo. Nunca peça documentos sensíveis no chat..." onChange={(event) => onChange({ customInstructions: event.target.value })} />
              <span className={form.hint}>Regras de conduta, tom de voz e limites que a IA respeita.</span>
            </label>
          </div>
        </section>
      </div>
    </>
  );
}
