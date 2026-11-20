"use client";

/**
 * Entradas por turno, separadas em WhatsApp e formulário (20/11/2026). Pedido do Vinicios: só intervalo e fila no
 * topo; o essencial é quanto entrou em cada turno por canal. Turnos do sistema: Turno 1 das 19h às 13h30 e
 * Turno 2 das 13h30 às 19h, dentro do dia de operação (19h às 19h; fim de semana entra no dia de sexta).
 * Atalho do dia a dia: exportar a tabela em CSV (abre no Excel) sem sair da tela.
 */
import { Download } from "lucide-react";

import {
  dayLabel,
  entriesCsv,
  share,
  SHIFT_LABELS,
  type ChannelCounts,
  type EntriesByTurn,
  type EntryShift,
} from "@/features/dashboard/entries/entries-by-turn-core";

import local from "./operation-view.module.css";
import { LiteItem, LiteNumber } from "./motion";

const SHIFTS: EntryShift[] = [1, 2];
const fmt = (value: number) => value.toLocaleString("pt-BR");

function SplitBar({ counts, top }: { counts: ChannelCounts; top: number }) {
  const width = top > 0 ? Math.max(Math.round((counts.total / top) * 100), counts.total > 0 ? 3 : 0) : 0;
  return (
    <span className={local.track} aria-hidden="true" style={{ display: "flex" }}>
      <span style={{ width: `${width}%`, display: "flex" }}>
        <span className={local.fill} style={{ width: `${share(counts.whatsapp, counts.total)}%` }} />
        <span className={local.fill} data-tone="muted" style={{ width: `${share(counts.form + counts.other, counts.total)}%` }} />
      </span>
    </span>
  );
}

export function EntriesView({ data, queueName, periodText, current = true }: {
  data: EntriesByTurn;
  queueName: string | null;
  periodText: string;
  /** O primeiro dia é o atual (atalhos de período); falso num intervalo personalizado. */
  current?: boolean;
}) {
  const { totals, shifts, days } = data;
  const showOther = totals.other > 0;
  const topShift = Math.max(shifts[1].total, shifts[2].total, 1);
  const strip = [
    { key: "total", label: "Entraram", value: totals.total, context: `${periodText} · ${queueName ?? "todas as filas"}` },
    { key: "whatsapp", label: "WhatsApp", value: totals.whatsapp, context: `${share(totals.whatsapp, totals.total)}% do que entrou` },
    { key: "form", label: "Formulário", value: totals.form, context: `${share(totals.form, totals.total)}% do que entrou` },
    { key: "average", label: "Média por dia", value: days.length ? Math.round(totals.total / days.length) : 0, context: `${days.length} ${days.length === 1 ? "dia" : "dias"} de operação` },
  ];
  const download = () => {
    const blob = new Blob([`﻿${entriesCsv(data)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `entradas-por-turno${queueName ? `-${queueName.toLowerCase().replace(/\s+/g, "-")}` : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const emptyText = `Nenhum lead entrou ${periodText.toLowerCase()} ${queueName ? `na fila ${queueName}` : "nas filas"}.`;

  return (
    <div className={local.view}>
      <LiteItem index={0}>
        <section className={local.strip} aria-labelledby="entries-numbers-title">
          <h2 id="entries-numbers-title" className={local.srOnly}>Entradas {periodText}</h2>
          <dl className={local.stripGrid}>
            {strip.map((item) => (
              <div key={item.key} className={local.stripCell}>
                <dt className={local.stripLabel}>{item.label}</dt>
                <dd className={local.stripValue}><LiteNumber value={item.value} /></dd>
                <dd className={local.stripContext}>{item.context}</dd>
              </div>
            ))}
          </dl>
        </section>
      </LiteItem>

      <LiteItem index={1}>
        <section className={local.panel} aria-labelledby="entries-shifts-title">
          <header className={local.panelHead}>
            <h2 id="entries-shifts-title" className={local.panelTitle}>Por turno</h2>
            <span className={local.panelMeta}>WhatsApp em destaque, formulário em cinza</span>
          </header>
          <table className={local.table}>
            <thead>
              <tr>
                <th scope="col">Turno</th>
                <th scope="col" className={local.num}>WhatsApp</th>
                <th scope="col" className={local.num}>Formulário</th>
                {showOther ? <th scope="col" className={local.num}>Outros</th> : null}
                <th scope="col" className={local.num}>Total</th>
                <th scope="col" className={local.barCol}><span className={local.srOnly}>Proporção</span></th>
              </tr>
            </thead>
            <tbody>
              {SHIFTS.map((shift) => (
                <tr key={shift}>
                  <th scope="row">{SHIFT_LABELS[shift].label} <span className={local.panelFoot}>{SHIFT_LABELS[shift].hours}</span></th>
                  <td className={local.num}>{fmt(shifts[shift].whatsapp)} <span className={local.panelFoot}>{share(shifts[shift].whatsapp, shifts[shift].total)}%</span></td>
                  <td className={local.num}>{fmt(shifts[shift].form)} <span className={local.panelFoot}>{share(shifts[shift].form, shifts[shift].total)}%</span></td>
                  {showOther ? <td className={local.num}>{fmt(shifts[shift].other)}</td> : null}
                  <td className={local.num}><strong>{fmt(shifts[shift].total)}</strong></td>
                  <td className={local.barCol}><SplitBar counts={shifts[shift]} top={topShift} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </LiteItem>

      <LiteItem index={2}>
        <section className={local.panel} aria-labelledby="entries-days-title">
          <header className={local.panelHead}>
            <h2 id="entries-days-title" className={local.panelTitle}>
              Dia a dia
              <span className={local.count}>{days.length}</span>
            </h2>
            <button type="button" className={local.panelFooterLink} onClick={download} disabled={totals.total === 0}>
              <Download aria-hidden="true" size={14} />
              Exportar CSV
            </button>
          </header>
          {totals.total === 0 ? (
            <p className={local.emptyText}>{emptyText}</p>
          ) : (
            <>
              <table className={local.table}>
                <thead>
                  <tr>
                    <th scope="col" rowSpan={2}>Dia (início às 19h)</th>
                    <th scope="colgroup" colSpan={2} className={local.num}>Turno 1 · 19h–13h30</th>
                    <th scope="colgroup" colSpan={2} className={local.num}>Turno 2 · 13h30–19h</th>
                    <th scope="col" rowSpan={2} className={local.num}>Total</th>
                  </tr>
                  <tr>
                    <th scope="col" className={local.num}>WhatsApp</th>
                    <th scope="col" className={local.num}>Formulário</th>
                    <th scope="col" className={local.num}>WhatsApp</th>
                    <th scope="col" className={local.num}>Formulário</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, index) => (
                    <tr key={day.start.toISOString()}>
                      <th scope="row">{index === 0 && current ? <strong>{dayLabel(day.start)} · atual</strong> : dayLabel(day.start)}</th>
                      <td className={local.num}>{fmt(day.shifts[1].whatsapp)}</td>
                      <td className={local.num}>{fmt(day.shifts[1].form)}</td>
                      <td className={local.num}>{fmt(day.shifts[2].whatsapp)}</td>
                      <td className={local.num}>{fmt(day.shifts[2].form)}</td>
                      <td className={local.num}><strong>{fmt(day.total.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={local.tableFoot}>
                Sábado e domingo entram no dia de sexta.
                {showOther ? ` Outros (manual e importação): ${fmt(totals.other)}, contados no total.` : ""}
              </p>
            </>
          )}
        </section>
      </LiteItem>
    </div>
  );
}
