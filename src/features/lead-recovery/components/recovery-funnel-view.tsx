"use client";

/**
 * Funil de recuperação (/qualificacao/recuperacao, plano §8.3), visual Lite: quatro blocos numa tela, sem troca de
 * visualização. 1) números do período; 2) por forma de follow-up; 3) recuperados por semana × linha de base × meta,
 * com o grupo de controle ao lado; 4) saúde do envio. Só lê os dados prontos (servidor ou laboratório).
 */
import type { ReactNode } from "react";
import Link from "next/link";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";

import { rate, RECOVERY_BASELINE_PER_WEEK, RECOVERY_TARGET_PER_WEEK, type RecoveryFunnelData, type RecoveryStepRow, type RecoveryWeek } from "../metrics-core";

const n = (value: number) => value.toLocaleString("pt-BR");
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const weekLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const TEMPLATE_STATUS: Record<string, string> = { MISSING: "não enviado", PENDING: "em análise na Meta", REJECTED: "rejeitado", PAUSED: "pausado", DISABLED: "desativado" };
const pct = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("pt-BR")}%`);

function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warning" }) {
  return (
    <div className={page.stat} data-tone={tone}>
      <span className={page.statLabel}>{label}</span>
      <span className={page.statValue}>{value}</span>
      {hint ? <span className={page.statHint}>{hint}</span> : null}
    </div>
  );
}

const stepColumns: LiteColumn<RecoveryStepRow>[] = [
  { id: "step", label: "Forma de follow-up", primary: true, render: (row) => row.label },
  { id: "sent", label: "Enviados", numeric: true, render: (row) => n(row.sent) },
  { id: "skipped", label: "Pulados", secondary: true, render: (row) => (row.skipped ? `${n(row.skipped)}${row.topSkipReason ? ` · ${row.topSkipReason}` : ""}` : <span className={page.muted}>Nenhum</span>) },
  { id: "replied", label: "Responderam em 24 h", numeric: true, render: (row) => `${n(row.replied)} (${pct(rate(row.replied, row.sent))})` },
  { id: "recovered", label: "Recuperados", numeric: true, render: (row) => n(row.recovered) },
  { id: "cost", label: "Custo Meta", numeric: true, nowrap: true, render: (row) => (row.costBrl ? brl.format(row.costBrl) : <span className={page.muted}>Sem custo</span>) },
];

function weekColumns(controlPct: number): LiteColumn<RecoveryWeek>[] {
  return [
    { id: "week", label: "Semana", primary: true, render: (row) => `Semana de ${weekLabel.format(new Date(row.weekStart))}` },
    { id: "recovered", label: "Recuperados", numeric: true, render: (row) => <span className={page.cellTitle}>{n(row.recovered + row.recoveredControl)}</span> },
    { id: "rate", label: "Taxa (cadência)", numeric: true, render: (row) => pct(rate(row.recovered, row.entered)) },
    { id: "control", label: `Taxa do controle (${controlPct}%)`, numeric: true, render: (row) => (row.enteredControl ? `${pct(rate(row.recoveredControl, row.enteredControl))} de ${n(row.enteredControl)}` : <span className={page.muted}>—</span>) },
    { id: "goal", label: "Da meta", numeric: true, secondary: true, render: (row) => pct(rate(row.recovered + row.recoveredControl, RECOVERY_TARGET_PER_WEEK)) },
  ];
}

export function RecoveryFunnelView({ data, filters }: { data: RecoveryFunnelData; filters?: ReactNode }) {
  const { numbers, steps, weeks, health } = data;
  const lastFull = weeks.length > 1 ? weeks[weeks.length - 2] : weeks[weeks.length - 1];
  const lastTotal = lastFull ? lastFull.recovered + lastFull.recoveredControl : 0;
  const optOutRate = rate(health.optOuts, health.sends);
  const statusLine = data.recoveryEnabled
    ? `Cadência de recuperação ligada · controle de ${data.controlPct}%.`
    : "Cadência de recuperação desligada: os números mostram o que já existe hoje (lembretes do turbo e follow-up de silêncio).";

  return (
    <>
      <section className={page.group} aria-labelledby="recovery-numbers-title">
        <header className={page.cardHead}>
          <h2 id="recovery-numbers-title" className={page.cardTitle}>Funil de recuperação</h2>
          <p className={page.cardDescription}>
            Leads de anúncio · {data.periodText.toLowerCase()} · {data.queueName ?? "todas as filas"}. Recuperado = entrou na recuperação (virou frio, recebeu lembrete ou follow-up) e depois respondeu e ficou quente, morno ou foi para cotação.
          </p>
        </header>
        {filters ? <div className={page.toolbar}>{filters}</div> : null}
        <p className={page.resultLine} aria-live="polite">{statusLine}{data.touchesTableMissing ? " A migration 0234 ainda não foi aplicada: os toques novos não aparecem." : ""}</p>
        <div className={page.stats} aria-label="Números do período">
          <Stat label="Entraram" value={n(numbers.entered)} hint={`${n(numbers.qualifying)} em qualificação`} />
          <Stat label="Quentes" value={n(numbers.hot)} hint={pct(rate(numbers.hot, numbers.entered))} />
          <Stat label="Parou no meio" value={n(numbers.stoppedMidway)} tone={numbers.stoppedMidway ? "warning" : undefined} />
          <Stat label="Nunca respondeu" value={n(numbers.neverReplied)} />
          <Stat label="Em follow-up" value={n(numbers.inFollowUp)} hint="lembretes em andamento" />
          <Stat label="Fila de ligação" value={n(numbers.callQueue)} hint={`${n(numbers.nurture)} em nutrição`} />
          <Stat label="Recuperados" value={n(numbers.recovered)} hint={pct(rate(numbers.recovered, numbers.entered))} />
          <Stat label="Não contatar" value={n(numbers.doNotContact)} />
        </div>
      </section>

      <section className={page.group} aria-labelledby="recovery-steps-title">
        <header className={page.cardHead}>
          <h2 id="recovery-steps-title" className={page.cardTitle}>Por forma de follow-up</h2>
          <p className={page.cardDescription}>Cada passo: quantos saíram, quantos foram pulados e por quê, quem respondeu em 24 h e quanto custou na Meta (estimativa).</p>
        </header>
        <LiteResponsiveData caption="Recuperação por forma de follow-up" columns={stepColumns} rows={steps} rowKey={(row) => row.step} empty={<p className={page.emptyText}>Nenhum lembrete ou follow-up no período.</p>} rowTone={(row) => (row.skipped > row.sent ? "warning" : undefined)} />
      </section>

      <section className={page.group} aria-labelledby="recovery-goal-title">
        <header className={page.cardHead}>
          <h2 id="recovery-goal-title" className={page.cardTitle}>Meta: dobrar os recuperados</h2>
          <p className={page.cardDescription}>
            Linha de base {n(RECOVERY_BASELINE_PER_WEEK)} por semana, meta {n(RECOVERY_TARGET_PER_WEEK)}. Última semana fechada: {n(lastTotal)}. O grupo de controle recebe só o que existe hoje; a diferença entre as taxas é o efeito da cadência. Sem conclusão antes de 6 a 8 semanas.
          </p>
        </header>
        <div className={page.stats} aria-label="Meta">
          <Stat label="Última semana" value={n(lastTotal)} hint={`de ${n(RECOVERY_TARGET_PER_WEEK)} (meta)`} tone={lastTotal < RECOVERY_BASELINE_PER_WEEK ? "warning" : undefined} />
          <Stat label="Linha de base" value={n(RECOVERY_BASELINE_PER_WEEK)} hint="por semana, out–nov/2026" />
          <Stat label="Falta para a meta" value={n(Math.max(0, RECOVERY_TARGET_PER_WEEK - lastTotal))} hint="na última semana fechada" />
        </div>
        <LiteResponsiveData caption="Recuperados por semana" columns={weekColumns(data.controlPct)} rows={[...weeks].reverse()} rowKey={(row) => row.weekStart} empty={<p className={page.emptyText}>Sem semanas no período.</p>} />
      </section>

      <section className={page.group} aria-labelledby="recovery-health-title">
        <header className={page.cardHead}>
          <h2 id="recovery-health-title" className={page.cardTitle}>Saúde do envio</h2>
          <p className={page.cardDescription}>Opt-out, limite da Meta e templates que ainda não estão aprovados.</p>
        </header>
        <div className={page.stats} aria-label="Saúde">
          <Stat label="Envios" value={n(health.sends)} hint="lembretes e follow-ups" />
          <Stat label="Pediram para sair" value={n(health.optOuts)} hint={`${pct(optOutRate)} dos envios`} tone={optOutRate !== null && optOutRate > 2 ? "warning" : undefined} />
          <Stat label="Limite da Meta (131049)" value={n(health.limit131049)} tone={health.limit131049 ? "warning" : undefined} hint="mensagens de marketing barradas" />
          <Stat label="Templates não aprovados" value={n(health.templatesNotApproved.length)} tone={health.templatesNotApproved.length ? "warning" : undefined} hint={health.templatesNotApproved.length ? "os passos deles são pulados" : "todos aprovados"} />
        </div>
        {health.templatesNotApproved.length ? (
          <p className={page.resultLine}>
            {health.templatesNotApproved.map((template) => `${template.label} (${TEMPLATE_STATUS[template.status] ?? template.status.toLowerCase()})`).join(" · ")} · <Link href="/qualificacao/turbo">Enviar para aprovação</Link>
          </p>
        ) : null}
      </section>
    </>
  );
}
