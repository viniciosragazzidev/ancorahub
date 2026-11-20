"use client";

/**
 * Aba "Visão da operação" do Painel (Lite). Reorganizada em 20/11/2026 pela skill `interface-enxuta` e pela
 * referência P3 do Jubayer: faixa de números num painel só, coluna principal com o funil e a tabela de filas, e
 * coluna lateral com "Precisa de atenção" (até 3 itens, um verbo cada) e "Agora" (plantões e WhatsApp).
 * Os dados são os mesmos do painel essencial. No celular, "Precisa de atenção" vem primeiro.
 */
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, CheckCircle2 } from "lucide-react";

import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { motionTokens as m } from "@/components/arc/motion-tokens";
import kit from "@/features/broker-performance/components/broker-performance-lite.module.css";
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";

import { attentionItems } from "./attention";
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

export function OperationView({ data, canOpenConversations = true }: { data: EssentialDashboard; canOpenConversations?: boolean }) {
  const { totals, rows, label } = data.queues;
  const { whatsapp, duties } = data;
  const { pageRows: whatsappPage, pagination: whatsappPagination } = useLitePages(whatsapp.brokers, 8);
  const [brokersOpen, setBrokersOpen] = useState(false);
  const attention = attentionItems(data);
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
  const topQueue = Math.max(...rows.map((row) => row.arrived), 1);
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
        {/* Coluna lateral primeiro no DOM: no celular a atenção aparece antes da análise. */}
        <div className={local.side}>
          <LiteItem index={1}>
            <section className={local.panel} aria-labelledby="operation-attention-title">
              <header className={local.panelHead}>
                <h2 id="operation-attention-title" className={local.panelTitle}>
                  Precisa de atenção
                  {attention.length ? <span className={local.count}>{attention.length}</span> : null}
                </h2>
              </header>
              {attention.length ? (
                <ul className={local.attentionList}>
                  {attention.map((item) => (
                    <li key={item.id} className={local.attentionItem} data-tone={item.tone}>
                      <span className={local.dot} aria-hidden="true" />
                      <div className={local.attentionBody}>
                        <p className={local.attentionTitle}>{item.title}</p>
                        <p className={local.attentionDetail}>{item.detail}</p>
                        <Link href={item.href} className={local.verb}>
                          {item.action}
                          <ArrowUpRight aria-hidden="true" size={14} />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={local.allClear}>
                  <CheckCircle2 aria-hidden="true" size={16} />
                  Tudo em dia. Nada pedindo decisão agora.
                </p>
              )}
            </section>
          </LiteItem>

          <LiteItem index={2}>
            <section className={local.panel} aria-labelledby="operation-now-title">
              <header className={local.panelHead}>
                <h2 id="operation-now-title" className={local.panelTitle}>Agora</h2>
              </header>
              <p className={local.groupLabel}>Plantões</p>
              {duties.running.length ? (
                <ul className={local.nowList}>
                  {duties.running.map((duty) => (
                    <li key={duty.scheduleId}>
                      <Link href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className={local.nowRow}>
                        <span className={local.nowName}>{duty.name}</span>
                        <span className={local.nowTime}>{duty.startsAt} às {duty.endsAt}</span>
                      </Link>
                      <p className={local.nowDetail}>
                        {n(duty.available)} disponíveis · {n(duty.distributed)} distribuídos ·{" "}
                        <span className={duty.belowMinimum ? local.warn : undefined}>{duty.activeBrokers}/{duty.brokerCount} corretores</span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={local.nowDetail}>
                  Nenhum plantão ativo.{duties.next ? ` Próximo: ${duties.next.name}, ${duties.next.dutyDate.slice(8, 10)}/${duties.next.dutyDate.slice(5, 7)} às ${duties.next.startsAt}.` : ""}{" "}
                  <Link href="/leads/distribuicao?view=plantao" className={local.inlineLink}>Ver plantões</Link>
                </p>
              )}

              <p className={local.groupLabel}>WhatsApp dos corretores</p>
              <p className={local.nowDetail}>{whatsappNote}</p>
              {whatsapp.connected > 0 ? (
                <dl className={local.figures}>
                  <div><dt>Recebidos</dt><dd><LiteNumber value={whatsapp.received} /></dd></div>
                  <div><dt>Respondendo · {whatsapp.responseRate}%</dt><dd><LiteNumber value={whatsapp.responding} /></dd></div>
                  <div><dt>Ativos</dt><dd><LiteNumber value={whatsapp.active} /></dd></div>
                </dl>
              ) : null}
              {whatsapp.brokers.length ? (
                <button type="button" className={local.panelFooterLink} onClick={() => setBrokersOpen(true)} aria-haspopup="dialog">
                  Ver corretores ({n(whatsapp.brokers.length)})
                  <ArrowRight aria-hidden="true" size={14} />
                </button>
              ) : null}
            </section>
          </LiteItem>
        </div>

        <div className={local.main}>
          <LiteItem index={1}>
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

          <LiteItem index={2}>
            <section className={local.panel} aria-labelledby="operation-queues-title">
              <header className={local.panelHead}>
                <h2 id="operation-queues-title" className={local.panelTitle}>
                  Leads por fila
                  {rows.length ? <span className={local.count}>{rows.length}</span> : null}
                </h2>
              </header>
              {empty ? (
                <p className={local.emptyText}>Nenhum lead entrou {label}. Quando entrar, aparece aqui separado por fila.</p>
              ) : (
                <>
                  <table className={local.table}>
                    <thead>
                      <tr>
                        <th scope="col">Fila</th>
                        <th scope="col" className={local.num}>Entraram</th>
                        <th scope="col" className={local.num}>Qualificados</th>
                        <th scope="col" className={local.num}>Frios</th>
                        <th scope="col" className={local.num}>Aguardando</th>
                        <th scope="col" className={local.barCol}><span className={local.srOnly}>Volume</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.id ?? row.name}>
                          <th scope="row">
                            {row.id ? <Link href={`/leads?fila=${encodeURIComponent(row.id)}`} className={local.rowName}>{row.name}</Link> : <span className={local.rowName}>{row.name}</span>}
                          </th>
                          <td className={local.num}>{n(row.arrived)}</td>
                          <td className={local.num}>{n(row.qualified)}</td>
                          <td className={local.num}>{n(row.cold)}</td>
                          <td className={local.num} data-warn={row.waiting > 0 ? "true" : undefined}>{n(row.waiting)}</td>
                          <td className={local.barCol}><Bar percent={Math.max(Math.round((row.arrived / topQueue) * 100), 4)} step={Math.min(index, 2)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className={local.tableFoot}>
                    {plural(rows.length, "fila", "filas")} · {plural(totals.arrived, "lead", "leads")} {label}
                  </p>
                </>
              )}
            </section>
          </LiteItem>
        </div>
      </div>

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
