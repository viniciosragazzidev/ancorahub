"use client";

/**
 * Entradas por turno, separadas em WhatsApp e formulário (20/11/2026). Pedido do Vinicios para a aba Qualidade
 * (e o Funil): só intervalo e fila no topo, e o essencial é quanto entrou em cada turno por canal.
 * Turno = dia de operação das 19h às 19h; sábado e domingo entram no turno de sexta.
 * Atalho do dia a dia: exportar a tabela em CSV (abre no Excel) sem sair da tela.
 */
import { Download } from "lucide-react";

import { entriesCsv, share, turnLabel, type EntriesByTurn } from "@/features/dashboard/entries/entries-by-turn-core";

import local from "./operation-view.module.css";
import { LiteItem, LiteNumber } from "./motion";

function SplitBar({ whatsapp, form, other, top }: { whatsapp: number; form: number; other: number; top: number }) {
  const total = whatsapp + form + other;
  const width = top > 0 ? Math.max(Math.round((total / top) * 100), total > 0 ? 3 : 0) : 0;
  return (
    <span className={local.track} aria-hidden="true" style={{ display: "flex" }}>
      <span style={{ width: `${width}%`, display: "flex" }}>
        <span className={local.fill} style={{ width: `${share(whatsapp, total)}%` }} />
        <span className={local.fill} data-tone="muted" style={{ width: `${share(form + other, total)}%` }} />
      </span>
    </span>
  );
}

export function EntriesView({ data, queueName, periodText }: { data: EntriesByTurn; queueName: string | null; periodText: string }) {
  const { totals, turns } = data;
  const top = Math.max(...turns.map((turn) => turn.total), 1);
  const showOther = totals.other > 0;
  const strip = [
    { key: "total", label: "Entraram", value: totals.total, context: `${periodText} · ${queueName ?? "todas as filas"}` },
    { key: "whatsapp", label: "WhatsApp", value: totals.whatsapp, context: `${share(totals.whatsapp, totals.total)}% do que entrou` },
    { key: "form", label: "Formulário", value: totals.form, context: `${share(totals.form, totals.total)}% do que entrou` },
    { key: "average", label: "Média por turno", value: turns.length ? Math.round(totals.total / turns.length) : 0, context: `${turns.length} ${turns.length === 1 ? "turno" : "turnos"} no intervalo` },
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
        <section className={local.panel} aria-labelledby="entries-turns-title">
          <header className={local.panelHead}>
            <h2 id="entries-turns-title" className={local.panelTitle}>
              Entradas por turno
              <span className={local.count}>{turns.length}</span>
            </h2>
            <button type="button" className={local.panelFooterLink} onClick={download} disabled={totals.total === 0}>
              <Download aria-hidden="true" size={14} />
              Exportar CSV
            </button>
          </header>
          {totals.total === 0 ? (
            <p className={local.emptyText}>Nenhum lead entrou {periodText.toLowerCase()} {queueName ? `na fila ${queueName}` : "nas filas"}.</p>
          ) : (
            <>
              <table className={local.table}>
                <thead>
                  <tr>
                    <th scope="col">Turno (19h às 19h)</th>
                    <th scope="col" className={local.num}>WhatsApp</th>
                    <th scope="col" className={local.num}>Formulário</th>
                    {showOther ? <th scope="col" className={local.num}>Outros</th> : null}
                    <th scope="col" className={local.num}>Total</th>
                    <th scope="col" className={local.barCol}><span className={local.srOnly}>WhatsApp e formulário</span></th>
                  </tr>
                </thead>
                <tbody>
                  {turns.map((turn, index) => (
                    <tr key={turn.start.toISOString()}>
                      <th scope="row">{index === 0 ? <strong>{turnLabel(turn.start)} · atual</strong> : turnLabel(turn.start)}</th>
                      <td className={local.num}>{turn.whatsapp.toLocaleString("pt-BR")} <span className={local.panelFoot}>{share(turn.whatsapp, turn.total)}%</span></td>
                      <td className={local.num}>{turn.form.toLocaleString("pt-BR")} <span className={local.panelFoot}>{share(turn.form, turn.total)}%</span></td>
                      {showOther ? <td className={local.num}>{turn.other.toLocaleString("pt-BR")}</td> : null}
                      <td className={local.num}><strong>{turn.total.toLocaleString("pt-BR")}</strong></td>
                      <td className={local.barCol}><SplitBar whatsapp={turn.whatsapp} form={turn.form} other={turn.other} top={top} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={local.tableFoot}>
                Barra: WhatsApp em destaque, formulário em cinza. Sábado e domingo entram no turno de sexta.
                {showOther ? " Outros: manual e importação." : ""}
              </p>
            </>
          )}
        </section>
      </LiteItem>
    </div>
  );
}
