"use client";

/**
 * Aba "Visão geral" do Painel (Lite), cópia 1:1 do artifact "Painel da gestão no estilo do corretor" (27/11/2026):
 * quatro números com mini barras; Plantões agora e WhatsApp dos corretores lado a lado; Leads por fila com a
 * temperatura; Entradas por hora, WhatsApp x formulário. Dados reais do painel essencial (`EssentialDashboard`).
 */
import { useState } from "react";
import Link from "next/link";

import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import { compareNote, emptyPulse } from "@/features/dashboard/essential/pulse-core";

import styles from "./painel.module.css";
import { n, plural } from "./format";

const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Uma frase por regra fixa: a fila com mais frios (40%+) ou a que concentra a entrada. */
export function operationInsight(data: EssentialDashboard): string | null {
  const rows = data.queues.rows.filter((row) => row.arrived >= 5);
  if (rows.length === 0) return null;
  const leader = [...rows].sort((a, b) => b.arrived - a.arrived)[0];
  const coldest = [...rows].sort((a, b) => b.cold / b.arrived - a.cold / a.arrived)[0];
  const coldRate = share(coldest.cold, coldest.arrived);
  if (coldRate >= 40) {
    return `${coldest.name} tem ${coldRate}% de leads frios. ${leader.name === coldest.name ? "É também a fila com mais entrada." : `${leader.name} segue com a maior entrada.`}`;
  }
  if (rows.length < 2) return null;
  return `${leader.name} concentra ${share(leader.arrived, data.queues.totals.arrived)}% dos leads que entraram.`;
}

/** Iniciais do nome para o círculo da lista ("Adriana Moreira" vira "AM"). */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter((part) => /^[A-Za-zÀ-ÿ]/.test(part));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}

const money = (value: number) => `R$ ${Math.round(value).toLocaleString("pt-BR")}`;

function Spark({ values, highlightLast }: { values: number[]; highlightLast: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <div className={styles.spark} aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={index}
          className={styles.bar}
          data-now={highlightLast && index === values.length - 1 ? "true" : undefined}
          style={{ height: `${Math.max(4, Math.round((value / max) * 100))}%`, animationDelay: `${200 + index * 30}ms` }}
        />
      ))}
    </div>
  );
}

function hourNowInSaoPaulo(now: Date) {
  return Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
}

export function OperationView({ data, canOpenConversations = true, period = "today", current = true, now = new Date() }: {
  data: EssentialDashboard;
  canOpenConversations?: boolean;
  /** Período do topo: muda a comparação ("sobre ontem", "a semana anterior"). */
  period?: "today" | "7d" | "30d";
  /** Falso no intervalo personalizado: sem a coluna "Agora" nem comparação. */
  current?: boolean;
  now?: Date;
}) {
  const { totals, rows } = data.queues;
  const { whatsapp, duties } = data;
  const pulse = data.pulse ?? emptyPulse();
  const { pageRows: whatsappPage, pagination: whatsappPagination } = useLitePages(whatsapp.brokers, 8);
  const topBrokers = [...whatsapp.brokers].sort((a, b) => b.active - a.active).slice(0, 4);
  const [brokersOpen, setBrokersOpen] = useState(false);
  const periodWord = period === "today" ? "ontem" : period === "7d" ? "a semana anterior" : "o mês anterior";

  const kpis = [
    { key: "arrived", label: "Entraram", value: n(totals.arrived), note: (current ? compareNote(totals.arrived, pulse.previousArrived, periodWord) : null) ?? data.queues.label, spark: pulse.arrived, highlight: current },
    { key: "qualified", label: "Qualificados", value: n(totals.qualified), note: `${share(totals.qualified, totals.arrived)}% dos que entraram`, spark: pulse.qualified, highlight: false },
    { key: "distributed", label: "Distribuídos", value: n(pulse.distributedTotal), note: pulse.avgAssignMinutes === null ? "Nenhum distribuído no período" : `Tempo médio até o corretor: ${n(pulse.avgAssignMinutes)} min`, spark: pulse.distributed, highlight: false },
    { key: "sales", label: "Vendas", value: n(pulse.salesTotal), note: pulse.salesTotal ? `${money(pulse.salesValue)} vendidos` : "Nenhuma venda no período", spark: pulse.sales, highlight: false },
  ];

  const nowHour = current && period === "today" ? hourNowInSaoPaulo(now) : -1;
  const hourMax = Math.max(1, ...pulse.hours.map((hour) => hour.whatsapp + hour.form));
  const peak = [...pulse.hours].sort((a, b) => b.whatsapp + b.form - (a.whatsapp + a.form))[0];
  const hoursLabel = `Entradas por hora, das 06h às 19h${peak && peak.whatsapp + peak.form > 0 ? `; o pico foi às ${String(peak.hour).padStart(2, "0")}h` : ""}`;

  const brokerRow = (broker: (typeof whatsapp.brokers)[number]) => {
    const body = (
      <>
        <span className={styles.initials} aria-hidden="true">{initials(broker.name)}</span>
        <span className={styles.brokerName}>{broker.name}</span>
        <span className={`${styles.brokerCount} ${styles.num}`}>{n(broker.active)}</span>
      </>
    );
    return canOpenConversations
      ? <Link href={`/conversas?tab=leads&brokerId=${encodeURIComponent(broker.id)}`} className={styles.rowlink} title={`Ver conversas de ${broker.name}`}>{body}</Link>
      : <span className={styles.rowlink}>{body}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section aria-label="Números do período" className={styles.kpis}>
        {kpis.map((kpi, index) => (
          <article key={kpi.key} className={`${styles.card} ${styles.kpi} ${styles.in}`} style={{ animationDelay: `${160 + index * 40}ms` }}>
            <h3>{kpi.label}</h3>
            <p className={`${styles.kpiValue} ${styles.num}`}>{kpi.value}</p>
            <Spark values={kpi.spark} highlightLast={kpi.highlight} />
            <p className={`${styles.note} ${styles.num}`}>{kpi.note}</p>
          </article>
        ))}
      </section>

      <div className={styles.mobileOnly}>
        <section className={`${styles.card} ${styles.section} ${styles.in}`} aria-labelledby="m-plantoes" style={{ animationDelay: "260ms" }}>
          <div className={styles.sectionHead} style={{ marginBottom: 10 }}>
            <h2 id="m-plantoes">Plantões agora</h2>
            <Link href="/leads/distribuicao?view=plantao" className={styles.headLink} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>Ver escala</Link>
          </div>
          {duties.running.length ? (
            <div className={styles.duties}>
              {duties.running.map((duty) => (
                <Link key={duty.scheduleId} href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className={styles.dutyStack}>
                  <span className={styles.dutyStackHead}><span className={styles.dot} data-tone={duty.belowMinimum ? "danger" : undefined} aria-hidden="true" />{duty.name}<span className={styles.num}>{duty.startsAt} às {duty.endsAt}</span></span>
                  <span className={`${styles.dutyStackLine} ${styles.num}`}>
                    {n(duty.available)} esperando · {n(duty.distributed)} distribuídos · <span data-tone={duty.belowMinimum ? "danger" : undefined}>{duty.activeBrokers}/{duty.brokerCount} corretores{duty.belowMinimum ? ", abaixo do mínimo" : ""}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>Nenhum plantão ativo.{duties.next ? ` Próximo: ${duties.next.name}, ${duties.next.dutyDate.slice(8, 10)}/${duties.next.dutyDate.slice(5, 7)} às ${duties.next.startsAt}.` : ""}</p>
          )}
        </section>

        <section className={`${styles.card} ${styles.section} ${styles.in}`} aria-labelledby="m-filas" style={{ animationDelay: "300ms" }}>
          <h2 id="m-filas" className={styles.mobileTitle} style={{ marginBottom: 4 }}>Leads por fila</h2>
          <p className={styles.note} style={{ marginBottom: 8 }}>Quentes, mornos e frios de quem entrou {data.queues.label}</p>
          <ul className={styles.queueList}>
            {rows.map((row, index) => {
              const base = row.hot + row.warm + row.cold;
              const temp = `${plural(row.hot, "quente", "quentes")}, ${plural(row.warm, "morno", "mornos")}, ${plural(row.cold, "frio", "frios")}`;
              const seg = (part: number, color: string, delay: number) => ({ width: `${share(part, base)}%`, background: color, animationDelay: `${delay}ms` });
              return (
                <li key={row.id ?? row.name}>
                  <span className={styles.queueHead}>
                    <span className={styles.cellName} style={{ flex: 1, minWidth: 0 }}>{row.name}</span>
                    <span className={`${styles.cell} ${styles.num}`}>{n(row.arrived)}</span>
                    <span className={styles.note}>entraram</span>
                  </span>
                  <span className={styles.tempBar} role="img" aria-label={temp}>
                    <span className={styles.segFill} style={seg(row.hot, "var(--p-hot)", 300 + index * 40)} />
                    <span className={styles.segFill} style={seg(row.warm, "var(--p-warm)", 340 + index * 40)} />
                    <span className={styles.segFill} style={seg(row.cold, "var(--p-cold)", 380 + index * 40)} />
                  </span>
                  <span className={`${styles.note} ${styles.num}`}>{temp}</span>
                </li>
              );
            })}
            {rows.length === 0 ? <li><span className={styles.note}>Nenhum lead entrou no período.</span></li> : null}
          </ul>
        </section>

        <section className={`${styles.card} ${styles.section} ${styles.in}`} aria-labelledby="m-whats" style={{ animationDelay: "340ms" }}>
          <h2 id="m-whats" className={styles.mobileTitle} style={{ marginBottom: 10 }}>WhatsApp dos corretores</h2>
          <div className={styles.waFigures} style={{ marginBottom: 0 }}>
            <div><strong className={styles.num}>{n(whatsapp.received)}</strong><span>recebidas</span></div>
            <div><strong className={styles.num}>{whatsapp.responseRate}%</strong><span>respondidas</span></div>
            <div><strong className={styles.num}>{n(whatsapp.active)}</strong><span>atendendo</span></div>
          </div>
          <p className={`${styles.note} ${styles.num}`} style={{ marginTop: 10 }}>{n(whatsapp.connected)} de {n(whatsapp.total)} corretores com WhatsApp conectado</p>
        </section>
      </div>

      <div className={`${styles.twocol} ${styles.desktopOnly}`}>
        <section className={`${styles.card} ${styles.section} ${styles.in}`} aria-labelledby="plantoes" style={{ animationDelay: "220ms" }}>
          <div className={styles.sectionHead}>
            <h2 id="plantoes">Plantões agora</h2>
            <Link href="/leads/distribuicao?view=plantao" className={styles.headLink}>Ver escala</Link>
          </div>
          {duties.running.length ? (
            <div className={styles.duties}>
              {duties.running.map((duty) => (
                <Link key={duty.scheduleId} href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className={styles.duty} style={{ color: "inherit", textDecoration: "none" }}>
                  <div className={styles.dutyName}>
                    <span><span className={styles.dot} data-tone={duty.belowMinimum ? "danger" : undefined} aria-hidden="true" />{duty.name}</span>
                    <span className={`${styles.dutyHours} ${styles.num}`}>{duty.startsAt} às {duty.endsAt}</span>
                  </div>
                  <div className={styles.dutyFigures}>
                    <span><strong className={styles.num}>{n(duty.available)}</strong><span>esperando</span></span>
                    <span><strong className={styles.num}>{n(duty.distributed)}</strong><span>distribuídos</span></span>
                    <span>
                      <strong className={styles.num} data-tone={duty.belowMinimum ? "danger" : undefined}>{duty.activeBrokers}/{duty.brokerCount}</strong>
                      <span data-tone={duty.belowMinimum ? "danger" : undefined}>{duty.belowMinimum ? "abaixo do mínimo" : "confirmados"}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              Nenhum plantão ativo.{duties.next ? ` Próximo: ${duties.next.name}, ${duties.next.dutyDate.slice(8, 10)}/${duties.next.dutyDate.slice(5, 7)} às ${duties.next.startsAt}.` : ""}
            </p>
          )}
        </section>

        <section className={`${styles.card} ${styles.section} ${styles.in}`} aria-labelledby="whats" style={{ animationDelay: "260ms" }}>
          <div className={styles.sectionHead} style={{ marginBottom: 14 }}>
            <h2 id="whats">WhatsApp dos corretores</h2>
            {whatsapp.total ? <span className={`${styles.meta} ${styles.num}`}>{n(whatsapp.connected)} de {n(whatsapp.total)} conectados</span> : null}
          </div>
          <div className={styles.waFigures}>
            <div><strong className={styles.num}>{n(whatsapp.received)}</strong><span>recebidas</span></div>
            <div><strong className={styles.num}>{whatsapp.responseRate}%</strong><span>respondidas</span></div>
            <div><strong className={styles.num}>{n(whatsapp.active)}</strong><span>em atendimento</span></div>
          </div>
          {topBrokers.length ? (
            <ul className={styles.brokers} aria-label="Corretores com mais atendimentos">
              {topBrokers.map((broker) => <li key={broker.id}>{brokerRow(broker)}</li>)}
            </ul>
          ) : (
            <p className={styles.empty}>{whatsapp.total ? "Nenhum corretor conectado agora." : "Nenhum corretor com WhatsApp pessoal."}</p>
          )}
          {whatsapp.brokers.length > topBrokers.length ? (
            <button type="button" className={styles.headLink} style={{ marginTop: 10 }} onClick={() => setBrokersOpen(true)} aria-haspopup="dialog">
              Ver todos os corretores ({n(whatsapp.brokers.length)})
            </button>
          ) : null}
        </section>
      </div>

      <section className={`${styles.card} ${styles.tableCard} ${styles.in} ${styles.desktopOnly}`} aria-labelledby="filas" style={{ animationDelay: "300ms" }}>
        <div className={styles.sectionHead}>
          <h2 id="filas">Leads por fila</h2>
          <span className={styles.legend}>
            <span><i style={{ background: "var(--p-hot)" }} aria-hidden="true" />Quentes</span>
            <span><i style={{ background: "var(--p-warm)" }} aria-hidden="true" />Mornos</span>
            <span><i style={{ background: "var(--p-cold)" }} aria-hidden="true" />Frios</span>
          </span>
        </div>
        <div className={styles.scrollX}>
          <div role="table" aria-label="Leads por fila">
            <div className={`${styles.trow} ${styles.th}`} role="row">
              <span role="columnheader">Fila</span>
              <span role="columnheader" className={styles.r}>Entraram</span>
              <span role="columnheader" className={styles.r}>Qualificados</span>
              <span role="columnheader" className={styles.r}>Frios</span>
              <span role="columnheader" className={styles.r}>Na IA</span>
              <span role="columnheader">Temperatura</span>
            </div>
            {rows.map((row, index) => {
              const base = row.hot + row.warm + row.cold;
              const seg = (part: number, color: string, delay: number) => ({ width: `${share(part, base)}%`, background: color, animationDelay: `${delay}ms` });
              return (
                <div key={row.id ?? row.name} className={styles.trow} role="row">
                  <span role="cell" className={styles.cellName}>
                    {row.id ? <Link href={`/leads?fila=${encodeURIComponent(row.id)}`} style={{ color: "inherit", textDecoration: "none" }}>{row.name}</Link> : row.name}
                  </span>
                  <span role="cell" className={`${styles.cell} ${styles.num} ${styles.r}`}>{n(row.arrived)}</span>
                  <span role="cell" className={`${styles.cell} ${styles.num} ${styles.r}`}>{n(row.qualified)}</span>
                  <span role="cell" className={`${styles.cell} ${styles.num} ${styles.r}`}>{n(row.cold)}</span>
                  <span role="cell" className={`${styles.cellMuted} ${styles.num} ${styles.r}`}>{n(row.inQualification)}</span>
                  <span role="cell" className={styles.tempBar} aria-label={`${plural(row.hot, "quente", "quentes")}, ${plural(row.warm, "morno", "mornos")}, ${plural(row.cold, "frio", "frios")}`}>
                    <span className={styles.segFill} style={seg(row.hot, "var(--p-hot)", 300 + index * 40)} />
                    <span className={styles.segFill} style={seg(row.warm, "var(--p-warm)", 340 + index * 40)} />
                    <span className={styles.segFill} style={seg(row.cold, "var(--p-cold)", 380 + index * 40)} />
                  </span>
                </div>
              );
            })}
            {rows.length === 0 ? (
              <div className={styles.trow} role="row"><span role="cell" className={styles.cellMuted}>Nenhum lead entrou no período.</span></div>
            ) : null}
            <div className={`${styles.trow} ${styles.totalRow}`} role="row">
              <span role="cell" className={styles.cellName}>Total</span>
              <span role="cell" className={`${styles.cell} ${styles.num} ${styles.r}`}>{n(totals.arrived)}</span>
              <span role="cell" className={`${styles.cell} ${styles.num} ${styles.r}`}>{n(totals.qualified)}</span>
              <span role="cell" className={`${styles.cell} ${styles.num} ${styles.r}`}>{n(totals.cold)}</span>
              <span role="cell" className={`${styles.cell} ${styles.num} ${styles.r}`}>{n(totals.inQualification)}</span>
              <span role="cell" />
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.section} ${styles.in} ${styles.desktopOnly}`} aria-labelledby="horas" style={{ animationDelay: "340ms" }}>
        <div className={styles.sectionHead} style={{ marginBottom: 16 }}>
          <h2 id="horas">Entradas por hora</h2>
          <span className={styles.legend}>
            <span><i style={{ background: "#c9c9d3", borderRadius: 2 }} aria-hidden="true" />WhatsApp</span>
            <span><i style={{ background: "#8d8d9c", borderRadius: 2 }} aria-hidden="true" />Formulário</span>
            {nowHour >= 0 ? <span><i style={{ background: "var(--p-action)", borderRadius: 2 }} aria-hidden="true" />Agora</span> : null}
          </span>
        </div>
        <div className={styles.hours} role="img" aria-label={hoursLabel}>
          {pulse.hours.map((hour, index) => {
            const isNow = hour.hour === nowHour;
            return (
              <div key={hour.hour} className={styles.hourCol}>
                <span className={styles.bar} style={{ height: `${Math.round((hour.form / hourMax) * 100)}%`, background: isNow ? "var(--p-action-strong)" : "#8d8d9c", animationDelay: `${360 + index * 30}ms` }} />
                <span className={styles.bar} style={{ height: `${Math.round((hour.whatsapp / hourMax) * 100)}%`, background: isNow ? "var(--p-action)" : "#c9c9d3", animationDelay: `${360 + index * 30}ms` }} />
              </div>
            );
          })}
        </div>
        <div className={styles.hourLabels}>
          {pulse.hours.map((hour) => (
            <span key={hour.hour} className={styles.num} data-now={hour.hour === nowHour ? "true" : undefined}>{String(hour.hour).padStart(2, "0")}h</span>
          ))}
        </div>
      </section>

      <LiteSidePanel open={brokersOpen} onOpenChange={setBrokersOpen} title="WhatsApp dos corretores" description={`${n(whatsapp.connected)} de ${n(whatsapp.total)} conectados, por atendimentos ativos.`}>
        <div className={styles.gx} style={{ background: "transparent", minHeight: 0 }}>
          <ul className={styles.brokers}>
            {whatsappPage.map((broker) => <li key={broker.id}>{brokerRow(broker)}</li>)}
          </ul>
          <LitePagination {...whatsappPagination} label="Páginas dos corretores no WhatsApp" />
        </div>
      </LiteSidePanel>
    </div>
  );
}
