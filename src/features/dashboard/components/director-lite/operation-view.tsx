"use client";

/**
 * Aba "Visão geral" do Painel (Lite). Desde 27/11/2026, o desenho aprovado no artifact "Painel da gestão no estilo
 * do corretor": números em cartões; plantões e WhatsApp lado a lado; funil e leads por fila com a temperatura.
 * "Precisa de você" saiu daqui e virou o botão do topo com gaveta (attention-drawer.tsx). Os dados são os mesmos.
 */
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { motionTokens as m } from "@/components/arc/motion-tokens";
import kit from "@/features/broker-performance/components/broker-performance-lite.module.css";
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";

import local from "./operation-view.module.css";
import { n, plural } from "./format";
import { LiteItem, LiteNumber, useReduce } from "./motion";

/** Atraso para as barras encherem depois que os blocos assentam. */
const FILL_DELAY = m.duration.standard;

const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Barra que cresce da esquerda; com movimento reduzido aparece pronta. */
function Bar({ percent, step = 0, tone }: { percent: number; step?: number; tone?: "muted" }) {
  const reduce = useReduce();
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return (
    <span className={local.track} aria-hidden="true">
      <motion.span
        className={local.fill}
        data-tone={tone}
        initial={{ width: reduce ? width : "0%" }}
        animate={{ width }}
        transition={reduce ? { duration: 0 } : { ...m.spring.morph, delay: FILL_DELAY + step * m.stagger.line }}
      />
    </span>
  );
}

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

export function OperationView({ data, canOpenConversations = true }: { data: EssentialDashboard; canOpenConversations?: boolean }) {
  const { totals, rows, label } = data.queues;
  const { whatsapp, duties } = data;
  const { pageRows: whatsappPage, pagination: whatsappPagination } = useLitePages(whatsapp.brokers, 8);
  // Os 4 com mais atendimentos ativos ficam no cartão; o resto, em "Ver todos os corretores".
  const topBrokers = [...whatsapp.brokers].sort((a, b) => b.active - a.active).slice(0, 4);
  const [brokersOpen, setBrokersOpen] = useState(false);
  const insight = operationInsight(data);
  const empty = totals.arrived === 0;
  const qualifiedRate = share(totals.qualified, totals.arrived);

  const numbers = [
    { key: "arrived", label: "Entraram", value: totals.arrived, context: label, percent: empty ? 0 : 100 },
    { key: "qualified", label: "Qualificados", value: totals.qualified, context: `${qualifiedRate}% do que entrou`, percent: qualifiedRate },
    { key: "pending", label: "Em qualificação", value: totals.inQualification, context: `${share(totals.inQualification, totals.arrived)}% sem temperatura`, percent: share(totals.inQualification, totals.arrived) },
    { key: "cold", label: "Frios", value: totals.cold, context: `${share(totals.cold, totals.arrived)}% do que entrou`, percent: share(totals.cold, totals.arrived), muted: true },
  ];
  const stages = [
    { key: "arrived", label: "Entraram", value: totals.arrived },
    { key: "qualified", label: "Qualificados", value: totals.qualified },
    { key: "hot", label: "Quentes", value: totals.hot },
  ];
  const topStage = Math.max(...stages.map((stage) => stage.value), 1);
  const whatsappNote = whatsapp.connected === 0
    ? whatsapp.total
      ? `Nenhum dos ${n(whatsapp.total)} corretores conectou o WhatsApp pessoal ainda.`
      : "Nenhum corretor ativo para mostrar."
    : `${n(whatsapp.connected)} de ${n(whatsapp.total)} ${whatsapp.total === 1 ? "corretor conectou" : "corretores conectaram"} o WhatsApp pessoal, ${whatsapp.label}.`;

  return (
    <div className={local.view}>
      {/* Faixa de números: um painel só, células separadas por hairline. */}
      <LiteItem index={0}>
        <section className={local.strip} aria-labelledby="operation-numbers-title">
          <h2 id="operation-numbers-title" className={local.srOnly}>Leads {label}</h2>
          <dl className={local.stripGrid}>
            {numbers.map((item, index) => (
              <div key={item.key} className={local.stripCell}>
                <dt className={local.stripLabel}>{item.label}</dt>
                <dd className={local.stripValue}><LiteNumber value={item.value} /></dd>
                <dd className={local.stripContext}>{item.context}</dd>
                <dd className={local.stripBar}><Bar percent={item.percent} step={index} tone={item.muted ? "muted" : undefined} /></dd>
              </div>
            ))}
          </dl>
        </section>
      </LiteItem>

      <div className={local.columns}>
        <LiteItem index={1}>
          <section className={local.panel} aria-labelledby="operation-duties-title">
            <header className={local.panelHead}>
              <h2 id="operation-duties-title" className={local.panelTitle}>Plantões agora</h2>
              <Link href="/leads/distribuicao?view=plantao" className={local.headLink}>Ver escala</Link>
            </header>
            {duties.running.length ? (
              <ul className={local.dutyList}>
                {duties.running.map((duty) => (
                  <li key={duty.scheduleId}>
                    <Link href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className={local.dutyRow}>
                      <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <span className={local.dutyName}><span className={local.dutyDot} data-low={duty.belowMinimum ? "true" : undefined} aria-hidden="true" /><span>{duty.name}</span></span>
                        <span className={local.dutyTime}>{duty.startsAt} às {duty.endsAt}</span>
                      </span>
                      <span className={local.dutyFigures}>
                        <span><strong>{n(duty.available)}</strong><small>disponíveis</small></span>
                        <span><strong>{n(duty.distributed)}</strong><small>distribuídos</small></span>
                        <span data-low={duty.belowMinimum ? "true" : undefined}><strong>{duty.activeBrokers}/{duty.brokerCount}</strong><small>{duty.belowMinimum ? "abaixo do mínimo" : "corretores"}</small></span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={local.nowDetail}>
                Nenhum plantão ativo.{duties.next ? ` Próximo: ${duties.next.name}, ${duties.next.dutyDate.slice(8, 10)}/${duties.next.dutyDate.slice(5, 7)} às ${duties.next.startsAt}.` : ""}
              </p>
            )}
          </section>
        </LiteItem>

        <LiteItem index={2}>
          <section className={local.panel} aria-labelledby="operation-whatsapp-title">
            <header className={local.panelHead}>
              <h2 id="operation-whatsapp-title" className={local.panelTitle}>WhatsApp dos corretores</h2>
              {whatsapp.total ? <span className={local.panelMeta}>{n(whatsapp.connected)} de {n(whatsapp.total)} conectados</span> : null}
            </header>
            {whatsapp.connected > 0 ? (
              <dl className={local.figures}>
                <div><dt>recebidos</dt><dd><LiteNumber value={whatsapp.received} /></dd></div>
                <div><dt>respondendo · {whatsapp.responseRate}%</dt><dd><LiteNumber value={whatsapp.responding} /></dd></div>
                <div><dt>atendimentos ativos</dt><dd><LiteNumber value={whatsapp.active} /></dd></div>
              </dl>
            ) : (
              <p className={local.nowDetail}>{whatsappNote}</p>
            )}
            {topBrokers.length ? (
              <ul className={local.brokerList} aria-label="Corretores com mais atendimentos ativos">
                {topBrokers.map((broker) => {
                  const body = (
                    <>
                      <span className={local.brokerInitials} aria-hidden="true">{initials(broker.name)}</span>
                      <span className={local.brokerName}>{broker.name}</span>
                      <span className={local.brokerCount}>{n(broker.active)}</span>
                    </>
                  );
                  return (
                    <li key={broker.id}>
                      {canOpenConversations
                        ? <Link href={`/conversas?tab=leads&brokerId=${encodeURIComponent(broker.id)}`} className={local.brokerRow} title={`Ver conversas de ${broker.name}`}>{body}</Link>
                        : <div className={local.brokerRow}>{body}</div>}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {whatsapp.brokers.length > topBrokers.length ? (
              <button type="button" className={local.panelFooterLink} onClick={() => setBrokersOpen(true)} aria-haspopup="dialog">
                Ver todos os corretores ({n(whatsapp.brokers.length)})
                <ArrowRight aria-hidden="true" size={14} />
              </button>
            ) : null}
          </section>
        </LiteItem>
      </div>

      <LiteItem index={3}>
        <section className={local.panel} aria-labelledby="operation-funnel-title">
          <header className={local.panelHead}>
            <h2 id="operation-funnel-title" className={local.panelTitle}>Funil de qualificação</h2>
            {empty ? null : <span className={local.panelMeta}>{qualifiedRate}% qualificados · {plural(totals.hot, "quente", "quentes")} · {plural(totals.warm, "morno", "mornos")}</span>}
          </header>
          {empty ? (
            <p className={local.emptyText}>Nenhum lead entrou {label}. Quando entrar, o funil aparece aqui.</p>
          ) : (
            <>
              <div className={local.stages}>
                {stages.map((stage, index) => (
                  <div key={stage.key} className={local.stage}>
                    <span className={local.stageLabel}>{stage.label}</span>
                    <Bar percent={Math.max(Math.round((stage.value / topStage) * 100), stage.value > 0 ? 4 : 0)} step={index} />
                    <span className={local.stageValue}><LiteNumber value={stage.value} /></span>
                  </div>
                ))}
              </div>
              <p className={local.panelFoot}>
                {plural(totals.requalification.attempts, "tentativa", "tentativas")} de requalificação · {plural(totals.requalification.coldLeads, "frio", "frios")}: {n(totals.requalification.once)} com 1, {n(totals.requalification.twice)} com 2, {n(totals.requalification.threePlus)} com 3+
                {insight ? <><br />{insight}</> : null}
              </p>
            </>
          )}
        </section>
      </LiteItem>

      <LiteItem index={4}>
        <section className={local.panel} aria-labelledby="operation-queues-title">
          <header className={local.panelHead}>
            <h2 id="operation-queues-title" className={local.panelTitle}>
              Leads por fila
              {rows.length ? <span className={local.count}>{rows.length}</span> : null}
            </h2>
            {empty ? null : (
              <span className={local.legend} aria-hidden="true">
                <span><i style={{ background: "oklch(64% .2 30)" }} />Quentes</span>
                <span><i style={{ background: "oklch(75% .16 75)" }} />Mornos</span>
                <span><i style={{ background: "oklch(68% .12 235)" }} />Frios</span>
              </span>
            )}
          </header>
          {empty ? (
            <p className={local.emptyText}>Nenhum lead entrou {label}. Quando entrar, aparece aqui separado por fila.</p>
          ) : (
            <>
              <div className={local.tableWrap}>
                <table className={local.table}>
                  <thead>
                    <tr>
                      <th scope="col">Fila</th>
                      <th scope="col" className={local.num}>Entraram</th>
                      <th scope="col" className={local.num}>Qualificados</th>
                      <th scope="col" className={local.num}>Frios</th>
                      <th scope="col" className={local.num}>Aguardando</th>
                      <th scope="col" className={local.barCol}>Temperatura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const tempTotal = row.hot + row.warm + row.cold;
                      return (
                        <tr key={row.id ?? row.name}>
                          <th scope="row">
                            {row.id ? <Link href={`/leads?fila=${encodeURIComponent(row.id)}`} className={local.rowName}>{row.name}</Link> : <span className={local.rowName}>{row.name}</span>}
                          </th>
                          <td className={local.num}>{n(row.arrived)}</td>
                          <td className={local.num}>{n(row.qualified)}</td>
                          <td className={local.num}>{n(row.cold)}</td>
                          <td className={local.num} data-warn={row.waiting > 0 ? "true" : undefined}>{n(row.waiting)}</td>
                          <td className={local.barCol}>
                            <span className={local.temperature} role="img" aria-label={`${row.hot} quentes, ${row.warm} mornos, ${row.cold} frios`}>
                              {tempTotal ? (
                                <>
                                  <span data-level="hot" style={{ width: `${share(row.hot, tempTotal)}%` }} />
                                  <span data-level="warm" style={{ width: `${share(row.warm, tempTotal)}%` }} />
                                  <span data-level="cold" style={{ width: `${share(row.cold, tempTotal)}%` }} />
                                </>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className={local.tableFoot}>
                {plural(rows.length, "fila", "filas")} · {plural(totals.arrived, "lead", "leads")} {label}
              </p>
            </>
          )}
        </section>
      </LiteItem>

      <LiteSidePanel open={brokersOpen} onOpenChange={setBrokersOpen} title="WhatsApp dos corretores" description={whatsappNote}>
        <ul className={kit.carrierList} aria-label="Corretores conectados, com atendimentos ativos">
          {whatsappPage.map((broker) => {
            const body = (
              <>
                <span className={kit.carrierName}>{broker.name}</span>
                <span className={kit.carrierValue}>{plural(broker.active, "ativo", "ativos")} · {n(broker.responding)} de {n(broker.received)} respondendo</span>
              </>
            );
            return (
              <li key={broker.id}>
                {canOpenConversations ? (
                  <Link href={`/conversas?tab=leads&brokerId=${encodeURIComponent(broker.id)}`} className={kit.carrier} title={`Ver conversas de ${broker.name}`}>{body}</Link>
                ) : (
                  <div className={kit.carrier}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        <LitePagination {...whatsappPagination} label="Páginas dos corretores no WhatsApp" />
      </LiteSidePanel>
    </div>
  );
}
