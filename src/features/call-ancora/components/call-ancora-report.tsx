"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, ChevronRight, Radio } from "lucide-react";

import { Button } from "@/components/arc/button/button";

import {
  OUTCOME_REPORT_LABEL,
  REPORT_PERIODS,
  wasAnswered,
  type CallAncoraBrokerSummary,
  type CallAncoraCallRow,
  type CallAncoraCounts,
  type ReportPeriod,
} from "../report-rules";

type ListPayload = { period: ReportPeriod; totals: CallAncoraCounts; brokers: CallAncoraBrokerSummary[]; error?: string };
type DetailPayload = { period: ReportPeriod; broker: CallAncoraCounts & { brokerId: string; brokerName: string | null; inSessionNow: boolean }; calls: CallAncoraCallRow[]; error?: string };

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => dateTime.format(new Date(iso));

const OUTCOME_TONE: Record<CallAncoraCallRow["outcome"], string> = {
  interested: "bg-(--success)/10 text-(--success)",
  not_interested: "bg-(--surface-muted) text-(--text-secondary)",
  no_answer: "bg-(--surface-muted) text-(--text-secondary)",
  voicemail: "bg-(--surface-muted) text-(--text-secondary)",
  wrong_number: "bg-(--danger)/10 text-(--danger)",
};

/** Números do período: ligações, atenderam, com e sem interesse e o resto. */
function CountsRow({ counts }: { counts: CallAncoraCounts }) {
  const items: [string, number | string][] = [
    ["Ligações", counts.calls],
    ["Atenderam", counts.answered],
    ["Com interesse", counts.interested],
    ["Sem interesse", counts.notInterested],
    ["Não atendeu", counts.noAnswer],
    ["Caixa postal", counts.voicemail],
    ["Número errado", counts.wrongNumber],
    ["Em ligação", clock(counts.talkSeconds)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-(--surface-muted) px-3 py-2">
          <dt className="text-xs text-(--text-secondary)">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-(--foreground)">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Painel do diretor: corretores que usaram o Call Âncora e, ao abrir um, o histórico dele. */
export function CallAncoraReportPanel() {
  const [period, setPeriod] = useState<ReportPeriod>("7d");
  const [list, setList] = useState<ListPayload | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ period });
        if (selected) params.set("brokerId", selected);
        const response = await fetch(`/api/call-ancora/report?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json() as ListPayload & DetailPayload;
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o painel.");
        if (cancelled) return;
        setError(null);
        if (selected) setDetail(payload); else setList(payload);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o painel.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [period, selected]);

  return (
    <section className="mb-6 rounded-2xl border border-(--border) bg-(--surface) p-4 md:p-5" aria-labelledby="call-ancora-report-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-(--accent-subtle) text-(--accent-strong)"><BarChart3 className="size-5" aria-hidden="true" /></span>
          <div>
            <h2 id="call-ancora-report-title" className="font-semibold text-(--foreground)">Painel do Call Âncora</h2>
            <p className="text-xs text-(--text-secondary)">Quem ligou, quantos atenderam e o resultado de cada ligação.</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-(--surface-muted) p-1" role="group" aria-label="Período">
          {(Object.keys(REPORT_PERIODS) as ReportPeriod[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              className={`min-h-9 rounded-full px-3 text-sm ${period === key ? "bg-(--surface) font-semibold text-(--foreground) shadow-(--shadow-resting)" : "text-(--text-secondary)"}`}
            >
              {REPORT_PERIODS[key]}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-4 rounded-xl border border-(--danger)/25 bg-(--danger)/5 px-4 py-3 text-sm text-(--danger)" role="alert">{error}</p> : null}

      {selected ? (
        <div className="mt-4">
          <Button size="sm" variant="secondary" className="min-h-10 rounded-full" onClick={() => { setSelected(null); setDetail(null); }}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Todos os corretores
          </Button>
          {!detail ? (
            <p className="mt-4 text-sm text-(--text-secondary)" role="status">Carregando o histórico…</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-(--foreground)">{detail.broker.brokerName ?? "Corretor"}</h3>
                {detail.broker.inSessionNow ? <span className="inline-flex items-center gap-1 rounded-full bg-(--success)/10 px-2.5 py-1 text-xs font-medium text-(--success)"><Radio className="size-3.5" aria-hidden="true" /> Em sessão agora</span> : null}
              </div>
              <div className="mt-3"><CountsRow counts={detail.broker} /></div>
              {detail.calls.length === 0 ? (
                <p className="mt-4 text-sm text-(--text-secondary)">Nenhuma ligação neste período.</p>
              ) : (
                <ul className="mt-4 divide-y divide-(--border) rounded-xl border border-(--border)">
                  {detail.calls.map((call) => (
                    <li key={call.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-(--foreground)">{call.leadName}</p>
                        <p className="text-xs tabular-nums text-(--text-muted)">{call.phoneMasked} · {when(call.at)}{call.talkSeconds > 0 ? ` · ${clock(call.talkSeconds)} em ligação` : ""}{call.causeLabel ? ` · ${call.causeLabel}` : ""}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${OUTCOME_TONE[call.outcome]}`}>
                        {OUTCOME_REPORT_LABEL[call.outcome]}{call.auto ? " (automático)" : ""}{call.correction ? " (correção)" : ""}
                      </span>
                      {wasAnswered(call) ? <span className="text-xs text-(--text-secondary)">Atendeu</span> : null}
                      {call.assigned ? <span className="text-xs font-medium text-(--success)">Foi para a carteira</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : !list ? (
        !error ? <p className="mt-4 text-sm text-(--text-secondary)" role="status">Carregando…</p> : null
      ) : (
        <>
          <div className="mt-4"><CountsRow counts={list.totals} /></div>
          {list.brokers.length === 0 ? (
            <p className="mt-4 text-sm text-(--text-secondary)">Nenhum corretor ligou pelo Call Âncora neste período.</p>
          ) : (
            <ul className="mt-4 divide-y divide-(--border) rounded-xl border border-(--border)">
              {list.brokers.map((broker) => (
                <li key={broker.brokerId}>
                  <button type="button" onClick={() => setSelected(broker.brokerId)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--surface-muted)">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-(--foreground)">
                        {broker.brokerName}
                        {broker.inSessionNow ? <span className="inline-flex items-center gap-1 rounded-full bg-(--success)/10 px-2 py-0.5 text-xs font-medium text-(--success)"><Radio className="size-3" aria-hidden="true" /> Em sessão agora</span> : null}
                      </p>
                      <p className="text-xs tabular-nums text-(--text-muted)">
                        Última ligação {when(broker.lastCallAt)} · {broker.calls} ligações · {broker.answered} atenderam · {broker.interested} com interesse · {broker.notInterested} sem interesse
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-(--text-muted)" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
