"use client";

/**
 * "Qualidade dos leads" no visual Lite, cópia 1:1 do artifact "Qualidade dos leads e Funil da gestão" (27/11/2026):
 * quatro números, por fila, hora a hora (quando os bons acabaram) e a estimativa sem os frios, com os dados reais de
 * `getSimpleLeadQualityReport`. No celular segue o Celular.dc.html (cartões em 2 colunas, filas em lista).
 */
import Link from "next/link";
import { useState } from "react";

import type { SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";

import q from "./qualidade-funil.module.css";
import { noDataLabel, noLeadsSince, n, pct, periodWords, plural, ranOutLabel } from "./format";
import { hourAxis } from "./hour-axis";
import { queueWords } from "./qualidade-funil-text";

const enter = (index: number, base = 40) => ({ animationDelay: `${base + index * 40}ms` });
const width = (part: number, whole: number) => `${whole ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0}%`;

/** Central desligada pelo Super-admin: a visão da operação segue disponível. */
export function QualityDisabled() {
  return (
    <section className={`${q.card} ${q.pad20}`} role="status">
      <h2 className={q.ttl}>Central temporariamente indisponível</h2>
      <p className={q.help}>A Central de Relatórios foi desativada pelo Super-admin. A visão da operação continua disponível.</p>
      <p className={q.zero} style={{ marginTop: 12 }}><Link href="/dashboard" className={q.ghost}>Voltar ao painel</Link></p>
    </section>
  );
}

/**
 * Exportar fica no topo, só na aba Qualidade (artifact). Leva à tela completa com o mesmo período, que exporta.
 * `detailedHref` mantém o acesso à vista detalhada, que só existe lá.
 */
export function QualityToolbar({ legacyHref, detailedHref }: { legacyHref: string; detailedHref?: string }) {
  return (
    <span className={q.toolbar}>
      {detailedHref ? <Link href={detailedHref} className={q.ghost}>Detalhada</Link> : null}
      <Link href={legacyHref} className={q.exportPill} aria-label="Exportar na tela completa" title="Exportar na tela completa">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></svg>
        Exportar
      </Link>
    </span>
  );
}

function HourChart({ report, now }: { report: SimpleLeadQualityReportData; now?: Date | null }) {
  const [table, setTable] = useState(false);
  const axis = hourAxis(report, now);
  const timeline = report.hourly === "timeline";
  const firstRun = timeline ? axis.findIndex((hour) => hour.ranOut) : -1;
  const max = Math.max(1, ...axis.map((hour) => hour.good + hour.weak));
  const columns = { gridTemplateColumns: `repeat(${axis.length}, minmax(0, 1fr))` };
  const sent = report.distributed.total;
  const runOuts = report.byQueue.filter((queue) => queue.goodRanOut);
  const help = timeline
    ? runOuts.length
      ? `${runOuts.map((queue) => `${queueWords(queue.queue)}: os bons acabaram às ${ranOutLabel(queue.goodRanOut ?? "", report.period)}`).join("; ")}. Dali em diante só havia frios para entregar.`
      : sent
        ? "Em nenhuma hora os bons acabaram: sempre havia lead bom qualificado esperando."
        : `Nenhum lead foi distribuído ${periodWords(report.period)}, então os bons ainda não acabaram.`
    : "Período longo: cada coluna soma a mesma hora de todos os dias. A hora em que os bons acabam aparece escolhendo um dia só.";
  const empty = axis.every((hour) => hour.empty);
  const every = Math.max(1, Math.ceil(axis.length / 14));
  return (
    <section className={`${q.card} ${q.pad20} ${q.in}`} aria-labelledby="q-hora" style={enter(0, 200)}>
      <div className={q.hourHead}>
        <div>
          <h2 id="q-hora" className={q.ttl}>
            <span className={q.desktopOnly}>Hora a hora: quando os bons acabaram</span>
            <span className={q.phoneOnly}>Quando os bons acabaram</span>
          </h2>
          <p className={q.help}>{help}</p>
        </div>
        <div className={`${q.legend} ${q.desktopOnly}`} aria-hidden="true">
          <span><span className={`${q.swatch} ${q.swatchGood}`} />Bons</span>
          <span><span className={`${q.swatch} ${q.swatchWeak}`} />Frios</span>
        </div>
      </div>
      {empty ? (
        <p className={q.chartEmpty}>Nenhum lead entrou {periodWords(report.period)}.</p>
      ) : (
        <>
          <div className={q.hourGrid} style={columns} role="img" aria-label={`Leads bons e frios que entraram por hora, de ${axis[0]?.label} a ${axis[axis.length - 1]?.label}`}>
            {axis.map((hour, index) => (
              <div key={hour.key} className={q.hourCol} title={`${hour.label}: ${n(hour.good)} bons e ${n(hour.weak)} frios`}>
                {index === firstRun ? <span className={q.ranLine} aria-hidden="true" /> : null}
                <span className={`${q.barWeak} ${q.bar}`} data-tone={hour.weak ? "neutral" : undefined} data-top={hour.good ? undefined : "true"} style={{ height: width(hour.weak, max), animationDelay: `${index * 30}ms` }} />
                <span className={`${q.barGood} ${q.bar}`} data-tone={hour.good ? "success" : undefined} style={{ height: width(hour.good, max), animationDelay: `${index * 30}ms` }} />
              </div>
            ))}
          </div>
          <div className={`${q.hourLabels} ${q.desktopOnly}`} style={columns}>
            {axis.map((hour, index) => (
              <span key={hour.key} className={`${q.hourLabel} ${q.num}`} data-ran={index === firstRun ? "true" : undefined}>{index % every === 0 || index === firstRun ? hour.label : ""}</span>
            ))}
          </div>
          <div className={`${q.phoneOnly} ${q.phoneAxis}`}>
            <span>{axis[0]?.label}</span>
            {firstRun >= 0 ? <span style={{ color: "var(--p-warning)" }}>{axis[firstRun].label}</span> : null}
            <span>{axis[axis.length - 1]?.label}</span>
          </div>
        </>
      )}
      <div className={`${q.hourFoot} ${q.desktopOnly}`}>
        {firstRun >= 0 ? <span className={q.ranKey}>Bons acabaram</span> : <span />}
        <button type="button" className={q.ghost} aria-expanded={table} onClick={() => setTable((was) => !was)}>
          {table ? "Esconder a tabela" : "Ver hora a hora em tabela"}
        </button>
      </div>
      {table ? (
        <div className={q.hourTable}>
          <table>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Entraram bons</th>
                <th scope="col">Entraram frios</th>
                <th scope="col">Foram bons</th>
                <th scope="col">Foram frios</th>
                {timeline ? <th scope="col">Bons esperando</th> : null}
              </tr>
            </thead>
            <tbody>
              {report.hours.map((hour) => {
                const ranOut = hour.goodWaiting === 0 && hour.distributed.cold + hour.distributed.noReply > 0;
                return (
                  <tr key={hour.startsAt} data-tone={ranOut ? "warning" : undefined}>
                    <td>{hour.label}</td>
                    <td>{n(hour.arrived.good)}</td>
                    <td>{n(hour.arrived.cold + hour.arrived.noReply)}</td>
                    <td>{n(hour.distributed.good)}</td>
                    <td>{n(hour.distributed.cold + hour.distributed.noReply)}</td>
                    {timeline ? <td>{hour.goodWaiting === 0 ? "0, acabaram" : n(hour.goodWaiting ?? 0)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** A vista da aba. `unitName` null = todas as unidades; `widerHref` é o próximo passo do dia zerado (7 dias). */
export function QualityView({ report, unitName, now, widerHref }: { report: SimpleLeadQualityReportData; unitName: string | null; now?: Date | null; widerHref?: string }) {
  const arrivedWeak = report.arrived.cold + report.arrived.noReply;
  const sentWeak = report.distributed.cold + report.distributed.noReply;
  const when = periodWords(report.period);
  const empty = noDataLabel(report.period);
  const today = report.period === "today";
  if (!report.arrived.total) {
    return (
      <section className={`${q.card} ${q.pad20}`} role="status">
        <h2 className={q.ttl}>{today ? "Nenhum lead entrou hoje" : "Nenhum lead neste período"}</h2>
        <p className={q.help}>{today ? `${noLeadsSince(report.window.since, now)} Os números aparecem quando o primeiro lead entrar.` : "Escolha outro período ou outra fila."}</p>
        {today && widerHref ? <p className={q.zero} style={{ marginTop: 12 }}><Link href={widerHref} className={q.ghost}>Ver os últimos 7 dias</Link></p> : null}
      </section>
    );
  }
  const total = report.arrived.total;
  const stats = [
    { label: "Entraram", short: "Entraram", value: total, detail: unitName ? `Unidade ${unitName}` : "Todas as unidades", fill: total, tone: "var(--p-foreground)" },
    { label: "Bons (quentes e mornos)", short: "Bons", value: report.arrived.good, detail: `${pct(report.arrived.good, total)} do que entrou`, fill: report.arrived.good, tone: "var(--p-action)" },
    { label: "Frios", short: "Frios", value: arrivedWeak, detail: arrivedWeak ? `${pct(arrivedWeak, total)}: ${plural(report.arrived.cold, "frio", "frios")} e ${n(report.arrived.noReply)} sem resposta` : `Nenhum frio ${when}`, fill: arrivedWeak, tone: "rgb(16 16 40 / .3)" },
    { label: "Descartados ou em qualificação", short: "Descartados ou em qualif.", value: report.arrived.other, detail: `${pct(report.arrived.other, total)} do que entrou`, fill: report.arrived.other, tone: "rgb(16 16 40 / .18)" },
  ];
  const sent = report.distributed.total;
  return (
    <div className={q.stack}>
      {report.truncated ? <p className={q.note} role="status">Período muito longo: o relatório usa só os leads mais recentes. Escolha um período menor para ver tudo.</p> : null}

      <section aria-labelledby="q-quantos">
        <div className={`${q.sectionHead} ${q.desktopOnly}`}>
          <h2 id="q-quantos" className={q.ttl}>Quantos entraram e quantos são bons</h2>
          <span className={q.sectionAside}>Bom é quente ou morno validado</span>
        </div>
        <div className={q.grid4}>
          {stats.map((stat, index) => (
            <article key={stat.label} className={`${q.card} ${q.stat} ${q.in}`} style={enter(index)}>
              <h3 className={q.statLabel}><span className={q.desktopOnly}>{stat.label}</span><span className={q.phoneOnly}>{stat.short}</span></h3>
              <p className={`${q.statValue} ${q.num}`}>{n(stat.value)}</p>
              <span className={`${q.statTrack} ${q.desktopOnly}`}>
                <span className={`${q.fill} ${q.segFill}`} style={{ width: width(stat.fill, total), background: stat.tone }} />
              </span>
              <p className={q.statDetail}>{stat.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${q.card} ${q.tableCard} ${q.in}`} aria-labelledby="q-fila" style={enter(0, 160)}>
        <div className={q.tableHead}>
          <h2 id="q-fila" className={q.ttl}>Por fila</h2>
          <p className={`${q.help} ${q.desktopOnly}`}>{report.byQueue.length === 1 ? "Só uma fila recebeu leads." : "Quando os bons acabam numa fila, só sobram frios para entregar."}</p>
        </div>
        <div className={`${q.tableScroll} ${q.desktopOnly}`}>
          <div className={q.tableInner} role="table" aria-label="Leads por fila">
            <div className={`${q.trow} ${q.th}`} role="row">
              <span role="columnheader">Fila</span><span role="columnheader">Reter frios</span><span role="columnheader" className={q.r}>Entraram</span><span role="columnheader" className={q.r}>Bons</span><span role="columnheader" className={q.r}>Frios</span><span role="columnheader" className={q.r}>Distribuídos</span><span role="columnheader" className={q.r}>Frios distrib.</span><span role="columnheader" className={q.r}>Bons acabaram</span>
            </div>
            {report.byQueue.map((queue) => (
              <div key={queue.queueId ?? queue.queue} className={q.trow} role="row">
                <span role="cell" className={q.strong}>{queue.queue}</span>
                <span role="cell"><span className={`${q.chip} ${queue.holdColdLeads ? q.chipOn : q.chipOff}`}>{queue.holdColdLeads ? "Ligada" : "Desligada"}</span></span>
                <span role="cell" className={`${q.r} ${q.num}`}>{n(queue.arrived)}</span>
                <span role="cell" className={`${q.r} ${q.num}`}>{n(queue.good)} <span className={q.muted}>({pct(queue.good, queue.arrived)})</span></span>
                <span role="cell" className={`${q.r} ${q.num}`}>{n(queue.weak)}</span>
                <span role="cell" className={`${q.r} ${q.num}`}>{n(queue.distributed)}</span>
                <span role="cell" className={`${q.r} ${q.num}`}>{n(queue.distributedWeak)}</span>
                <span role="cell" className={`${q.r} ${q.num} ${queue.goodRanOut && report.hourly === "timeline" ? q.ran : q.muted}`}>
                  {report.hourly === "timeline" ? (queue.goodRanOut ? ranOutLabel(queue.goodRanOut, report.period) : "Não acabaram") : "Escolha um dia"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={q.phoneOnly} style={{ padding: "0 16px" }}>
          {report.byQueue.map((queue) => (
            <div key={queue.queueId ?? queue.queue} className={q.phoneQueue}>
              <span className={q.phoneQueueTop}><span className={q.phoneQueueName}>{queue.queue}</span><span className={q.chip} style={{ background: "transparent", padding: 0 }}>{queue.holdColdLeads ? "Reter frios" : "Sem reter"}</span></span>
              <span className={`${q.phoneQueueMain} ${q.num}`}>{n(queue.arrived)} entraram · {n(queue.good)} bons · {n(queue.weak)} frios</span>
              <span className={`${q.phoneQueueSub} ${q.num}`}>
                {n(queue.distributed)} distribuídos, {n(queue.distributedWeak)} frios ·{" "}
                <span className={queue.goodRanOut && report.hourly === "timeline" ? q.ran : undefined}>
                  {report.hourly === "timeline" ? (queue.goodRanOut ? `bons acabaram às ${ranOutLabel(queue.goodRanOut, report.period)}` : "bons não acabaram") : "escolha um dia"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <HourChart report={report} now={now} />

      <section className={`${q.card} ${q.estimate} ${q.in}`} aria-labelledby="q-sem" style={enter(0, 240)}>
        <div>
          <h2 id="q-sem" className={q.ttl}>E se não mandasse os frios? <span className={`${q.ttlNote} ${q.desktopOnly}`}>estimativa</span></h2>
          <p className={`${q.help} ${q.desktopOnly}`}>Tira os frios do que foi entregue e supõe que os bons seriam entregues igual.</p>
        </div>
        {sent ? (
          <>
            <div className={`${q.grid3} ${q.desktopOnly}`}>
              <div className={q.mutedBox}>
                <p className={q.statLabel}>Foram para os corretores</p>
                <p className={`${q.statValue} ${q.num}`}>{n(sent)}</p>
                <p className={q.statDetail}>{n(report.distributed.good)} bons e {n(sentWeak)} frios, {plural(report.brokers, "corretor", "corretores")}</p>
              </div>
              <div className={q.mutedBox}>
                <p className={q.statLabel}>Sem os frios seriam</p>
                <p className={`${q.statValue} ${q.num}`}>{n(report.withoutWeak.distributed)}</p>
                <p className={q.statDetail}>{report.withoutWeak.removed ? plural(report.withoutWeak.removed, "lead a menos", "leads a menos") : "Nenhum frio foi entregue"}</p>
              </div>
              <div className={q.mutedBox}>
                <p className={q.statLabel}>Média por corretor</p>
                {report.withoutWeak.perBrokerNow === null || report.withoutWeak.perBrokerWithout === null ? (
                  <p className={`${q.statValue} ${q.num}`}>{empty}</p>
                ) : (
                  <p className={`${q.statValue} ${q.num}`}>{decimal(report.withoutWeak.perBrokerNow)} <span className={q.para}>para</span> {decimal(report.withoutWeak.perBrokerWithout)}</p>
                )}
                <p className={q.statDetail}>agora e sem os frios</p>
              </div>
            </div>
            <div className={`${q.grid2} ${q.desktopOnly}`}>
              {report.shifts.map((shift) => {
                const totalShift = shift.distributedGood + shift.distributedWeak;
                return (
                  <div key={shift.key} className={q.shift}>
                    <h3>{shift.label}</h3>
                    {totalShift ? (
                      <>
                        <p className={q.shiftLine}>Receberam <strong className={q.num}>{n(totalShift)}</strong> leads: {n(shift.distributedGood)} bons e {n(shift.distributedWeak)} frios ({plural(shift.brokers, "corretor", "corretores")})</p>
                        <p className={q.statDetail} style={{ marginTop: 4 }}>Sem os frios: {n(shift.distributedGood)} leads{shift.brokers ? `, ${decimal(shift.distributedGood / shift.brokers)} por corretor` : ""}</p>
                      </>
                    ) : (
                      <p className={q.statDetail}>Nenhum lead distribuído neste turno.</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={q.phoneOnly}>
              <div className={q.kvList}>
                <div className={q.kv}><span>Foram para os corretores</span><span className={`${q.num} ${q.kvValue}`}>{n(sent)}</span></div>
                <div className={q.kv}><span>Sem os frios seriam</span><span className={`${q.num} ${q.kvValue}`}>{n(report.withoutWeak.distributed)}</span></div>
                <div className={q.kv}><span>Média por corretor</span><span className={`${q.num} ${q.kvValue}`}>{report.withoutWeak.perBrokerNow === null || report.withoutWeak.perBrokerWithout === null ? empty : `${decimal(report.withoutWeak.perBrokerNow)} para ${decimal(report.withoutWeak.perBrokerWithout)}`}</span></div>
              </div>
            </div>
          </>
        ) : (
          <p className={q.zero} role="status">
            Nenhum lead foi para os corretores {when}. A estimativa aparece com a primeira distribuição.
            <Link href="/leads/distribuicao?view=plantao" className={q.ghost}>Ver plantões</Link>
          </p>
        )}
        <p className={q.foot}>
          <span className={q.phoneOnly}>Estimativa. </span>Vendas vindas de leads frios {when}: {n(report.converted.weak)}. De leads bons: {n(report.converted.good)}.
        </p>
      </section>
    </div>
  );
}

function decimal(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
