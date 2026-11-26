"use client";

/**
 * Minhas ligações no Lite (26/11/2026, como no DeskComm): uma tabela das ligações do Call Âncora com um resumo discreto
 * no topo. Clicar na linha abre a gaveta do lead com as ligações para ele no período e o atalho para o lead.
 * Somente leitura, sem CTA na tela: a ligação nasce no app do celular.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { LiteUrlSelect } from "@/components/lite/controls/url-select";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import page from "@/components/lite/page/lite-page.module.css";
import { callResult, formatCallDuration, formatTalkTotal, type MyCallRow, type MyCallsSummary } from "@/features/call-ancora/my-calls-rules";
import { REPORT_PERIODS, type ReportPeriod } from "@/features/call-ancora/report-rules";

import styles from "./calls-lite.module.css";

export type CallsLiteProps = {
  rows: MyCallRow[];
  summary: MyCallsSummary;
  period: ReportPeriod;
  brokerId: string | null;
  brokers: { id: string; name: string }[];
  canSeeTeam: boolean;
  truncated: boolean;
};

const PERIOD_OPTIONS = Object.entries(REPORT_PERIODS).map(([value, label]) => ({ value, label }));
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => dateTime.format(new Date(iso)).replace(",", "");

function ResultBadge({ row }: { row: Pick<MyCallRow, "outcome" | "talkSeconds"> }) {
  const result = callResult(row);
  return (
    <span className={styles.result}>
      <span className={page.badge} data-tone={result.key === "answered" ? "success" : result.key === "wrong_number" ? "danger" : undefined}>{result.label}</span>
      {result.detail ? <span className={page.cellSub}>{result.detail}</span> : null}
    </span>
  );
}

function Duration({ seconds }: { seconds: number }) {
  const text = formatCallDuration(seconds);
  return text ? <span className={page.numeric}>{text}</span> : <span className={page.muted}>Sem conversa</span>;
}

export function CallsLite({ rows, summary, period, brokerId, brokers, canSeeTeam, truncated }: CallsLiteProps) {
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const leadCalls = useMemo(() => (openLeadId ? rows.filter((row) => row.leadId === openLeadId) : []), [rows, openLeadId]);
  const openLead = leadCalls[0] ?? null;
  const showBroker = canSeeTeam && !brokerId;

  const columns: LiteColumn<MyCallRow>[] = [
    { id: "when", label: "Quando", numeric: true, secondary: true, render: (row) => <time dateTime={row.at}>{when(row.at)}</time> },
    {
      id: "lead",
      label: "Lead",
      primary: true,
      render: (row) => (
        <span>
          <span className={page.cellTitle}>{row.leadName}</span>
          <span className={page.cellSub}>{row.phoneMasked}</span>
        </span>
      ),
    },
    ...(showBroker ? [{ id: "broker", label: "Corretor", nowrap: true, render: (row: MyCallRow) => <span title={row.brokerName}>{row.brokerName}</span> }] : []),
    { id: "duration", label: "Duração", numeric: true, render: (row) => <Duration seconds={row.talkSeconds} /> },
    { id: "result", label: "Resultado", phonePriority: "high", render: (row) => <ResultBadge row={row} /> },
  ];

  const brokerOptions = [{ value: "", label: "Todos os corretores" }, ...brokers.map((item) => ({ value: item.id, label: item.name }))];
  const periodLabel = REPORT_PERIODS[period].toLowerCase();

  return (
    <div className={page.group}>
      <div className={page.toolbar}>
        <LiteUrlSelect label="Período" param="periodo" value={period} defaultValue="7d" options={PERIOD_OPTIONS} className={page.selectNarrow} />
        {canSeeTeam ? <LiteUrlSelect label="Corretor" param="corretor" value={brokerId ?? ""} options={brokerOptions} className={page.select} /> : null}
      </div>

      <dl className={styles.summary} aria-label="Resumo do período">
        <div className={styles.summaryItem}><dt>Ligações</dt><dd>{summary.calls.toLocaleString("pt-BR")}</dd></div>
        <div className={styles.summaryItem}><dt>Atendidas</dt><dd>{summary.answered.toLocaleString("pt-BR")}</dd></div>
        <div className={styles.summaryItem}><dt>Tempo em ligação</dt><dd>{formatTalkTotal(summary.talkSeconds)}</dd></div>
      </dl>

      {rows.length === 0 ? (
        <div className={page.empty}>
          <h2 className={page.emptyTitle}>{period === "today" ? "Nenhuma ligação hoje" : `Nenhuma ligação em ${periodLabel}`}</h2>
          <p className={page.emptyText}>
            As ligações entram pelo Call Âncora no celular Android. Quem liga pela fila do app marca o resultado no fim da chamada, e ela aparece aqui com a duração.
          </p>
          {period !== "30d" ? <Link href={`?periodo=30d${brokerId ? `&corretor=${encodeURIComponent(brokerId)}` : ""}`} className={page.cellLink}>Ver os últimos 30 dias</Link> : null}
        </div>
      ) : (
        <LiteResponsiveData
          caption="Ligações do período"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowOpen={(row) => setOpenLeadId(row.leadId)}
          empty={null}
        />
      )}

      {truncated ? <p className={page.resultLine}>Mostrando as 2.000 ligações mais recentes do período.</p> : null}

      <LiteSidePanel
        open={Boolean(openLead)}
        onOpenChange={(open) => { if (!open) setOpenLeadId(null); }}
        title={openLead?.leadName ?? "Lead"}
        description={openLead?.phoneMasked}
      >
        {openLead ? (
          <div className={styles.panel}>
            <h3 className={page.sectionTitle}>{leadCalls.length === 1 ? "1 ligação no período" : `${leadCalls.length.toLocaleString("pt-BR")} ligações no período`}</h3>
            <ul className={styles.callList}>
              {leadCalls.map((call) => (
                <li key={call.id} className={styles.callItem}>
                  <span className={styles.callMain}>
                    <time dateTime={call.at} className={page.numeric}>{when(call.at)}</time>
                    {canSeeTeam ? <span className={page.cellSub}>{call.brokerName}</span> : null}
                  </span>
                  <Duration seconds={call.talkSeconds} />
                  <ResultBadge row={call} />
                </li>
              ))}
            </ul>
            <Link href={`/leads/${encodeURIComponent(openLead.leadId)}`} className={page.primaryButton}>Abrir lead</Link>
          </div>
        ) : null}
      </LiteSidePanel>
    </div>
  );
}
