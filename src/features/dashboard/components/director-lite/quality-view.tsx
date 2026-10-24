"use client";

/**
 * "Qualidade dos leads" no visual Lite: a vista Simples (quatro perguntas do dono) com os dados reais
 * de `getSimpleLeadQualityReport`. A vista detalhada continua na tela antiga por enquanto.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Info, SearchX, Table2 } from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import type { SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";

import styles from "./director-lite.module.css";
import { n, pct, share } from "./format";
import { enterT, exitT, LiteColumn, LiteItem, LiteNumber, LiteReveal } from "./motion";

function Stat({ label, value, detail, tone, index, kind = "int" }: { label: string; value: number; detail?: string; tone?: "good" | "weak"; index: number; kind?: "int" | "dec" }) {
  return (
    <LiteItem index={index} className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <LiteNumber value={value} kind={kind} className={`${styles.statValue} ${tone === "good" ? styles.good : tone === "weak" ? styles.weak : ""}`} />
      {detail ? <span className={styles.statDetail}>{detail}</span> : null}
    </LiteItem>
  );
}

function Question({ number, title, children, help }: { number: number; title: string; children: ReactNode; help?: ReactNode }) {
  return (
    <LiteReveal as="section" className={styles.block} label={title}>
      <h2 className={styles.blockTitle}><span className={styles.stepNumber}>{number}</span>{title}</h2>
      {help ? <p className={styles.blockHelp}>{help}</p> : null}
      {children}
    </LiteReveal>
  );
}

function HourChart({ report }: { report: SimpleLeadQualityReportData }) {
  const max = Math.max(1, ...report.hours.map((hour) => Math.max(hour.arrived.good, hour.arrived.cold + hour.arrived.noReply)));
  return (
    <div className={styles.hourChart}>
      <div className={styles.legend} aria-hidden="true">
        <span><span className={styles.legendSwatch} data-tone="success" />Entraram bons</span>
        <span><span className={styles.legendSwatch} data-tone="neutral" />Entraram frios</span>
        {report.hourly === "timeline" ? <span><span className={styles.legendSwatch} data-tone="warning" />Bons acabaram</span> : null}
      </div>
      <div className={styles.hourBars} role="img" aria-label="Leads bons e frios que entraram por hora">
        {report.hours.map((hour, index) => {
          const weak = hour.arrived.cold + hour.arrived.noReply;
          const ranOut = hour.goodWaiting === 0 && hour.distributed.cold + hour.distributed.noReply > 0;
          return (
            <span key={hour.startsAt} className={styles.hourSlot} data-ranout={ranOut || undefined}>
              <span className={styles.hourPair}>
                <LiteColumn value={hour.arrived.good / max} delay={Math.min(index, 12) * 0.03} tone="success" label={`${hour.label}: ${n(hour.arrived.good)} bons`} />
                <LiteColumn value={weak / max} delay={Math.min(index, 12) * 0.03} tone="neutral" label={`${hour.label}: ${n(weak)} frios`} />
              </span>
              <span className={styles.hourTick}>{index % 2 === 0 ? hour.label : ""}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Central desligada pelo Super-admin: a visão da operação segue disponível. */
export function QualityDisabled() {
  return (
    <div className={styles.card}>
      <div className={styles.cardEmpty}>
        <EmptyState
          icon={<Info aria-hidden="true" />}
          title="Central temporariamente indisponível"
          description="A Central de Relatórios foi desativada pelo Super-admin. A visão da operação continua disponível."
          action={<Link href="/dashboard" className={styles.secondaryButton}>Voltar ao painel</Link>}
        />
      </div>
    </div>
  );
}

/** A vista Simples: entraram e bons, por fila, hora a hora e o que mudaria sem os frios. `unitName` null = todas as unidades. */
export function QualityView({ report, unitName }: { report: SimpleLeadQualityReportData; unitName: string | null }) {
  const [table, setTable] = useState(false);
  const arrivedWeak = report.arrived.cold + report.arrived.noReply;
  const sentWeak = report.distributed.cold + report.distributed.noReply;
  const runOuts = report.byQueue.filter((queue) => queue.goodRanOut);
  const inversions = report.byQueue.filter((queue) => queue.weakWhileGoodWaiting > 0);
  if (!report.arrived.total) {
    return (
      <div className={styles.card}>
        <div className={styles.cardEmpty}>
          <EmptyState icon={<SearchX aria-hidden="true" />} title="Nenhum lead neste período" description="Escolha outro período ou outra unidade." />
        </div>
      </div>
    );
  }
  const scope = unitName ? `Unidade ${unitName}` : "Todas as unidades";
  return (
    <div className={styles.stack}>
      {report.truncated ? <p className={styles.note} data-tone="warning"><AlertTriangle aria-hidden="true" size={16} />Período muito longo: o relatório usa só os leads mais recentes. Escolha um período menor para ver tudo.</p> : null}
      <Question number={1} title="Quantos leads entraram e quantos são bons" help="Bom é quente ou morno validado. Lead de WhatsApp só conta como bom se o cliente respondeu a qualificação.">
        <div className={styles.stats4}>
          <Stat index={0} label="Entraram" value={report.arrived.total} detail={scope} />
          <Stat index={1} label="Bons (quentes e mornos)" value={report.arrived.good} detail={`${pct(report.arrived.good, report.arrived.total)} do que entrou`} tone="good" />
          <Stat index={2} label="Frios" value={arrivedWeak} detail={`${n(report.arrived.cold)} frios e ${n(report.arrived.noReply)} de WhatsApp que não responderam, ${pct(arrivedWeak, report.arrived.total)}`} tone="weak" />
          <Stat index={3} label="Descartados ou em qualificação" value={report.arrived.other} detail={pct(report.arrived.other, report.arrived.total)} />
        </div>
      </Question>

      <Question number={2} title="Por fila">
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Fila de entrada</th>
                <th scope="col">Reter frios</th>
                <th scope="col" className={styles.numCol}>Entraram</th>
                <th scope="col" className={styles.numCol}>Bons</th>
                <th scope="col" className={styles.numCol}>Frios</th>
                <th scope="col" className={styles.numCol}>Distribuídos</th>
                <th scope="col" className={styles.numCol}>Frios distribuídos</th>
                <th scope="col" className={styles.numCol}>Bons acabaram</th>
              </tr>
            </thead>
            <tbody>
              {report.byQueue.map((queue) => (
                <tr key={queue.queue}>
                  <td data-label="Fila"><span className={styles.cellMain}>{queue.queue}</span></td>
                  <td data-label="Reter frios"><span className={styles.badge} data-tone={queue.holdColdLeads ? "success" : "neutral"}>{queue.holdColdLeads ? "Ligada" : "Desligada"}</span></td>
                  <td data-label="Entraram" className={styles.numCol}>{n(queue.arrived)}</td>
                  <td data-label="Bons" className={styles.numCol}>{n(queue.good)} <span className={styles.muted}>({pct(queue.good, queue.arrived)})</span></td>
                  <td data-label="Frios" className={styles.numCol}>{n(queue.weak)}</td>
                  <td data-label="Distribuídos" className={styles.numCol}>{n(queue.distributed)}</td>
                  <td data-label="Frios distribuídos" className={styles.numCol}>{n(queue.distributedWeak)}</td>
                  <td data-label="Bons acabaram" className={styles.numCol}>{report.hourly === "timeline" ? queue.goodRanOut ?? "Não acabaram" : "Escolha um dia"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Question>

      <Question
        number={3}
        title="Hora a hora: quando os bons acabaram"
        help={
          report.hourly === "timeline"
            ? runOuts.length
              ? `${runOuts.map((queue) => `${queue.queue}: os bons acabaram às ${queue.goodRanOut}`).join("; ")}. Dali em diante só havia frios para entregar.`
              : "Em nenhuma hora os bons acabaram: sempre havia lead bom qualificado esperando."
            : "Período longo: cada coluna soma a mesma hora de todos os dias. A hora em que os bons acabam aparece escolhendo um dia só."
        }
      >
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <HourChart report={report} />
            <button type="button" className={styles.ghostButton} onClick={() => setTable((was) => !was)} aria-expanded={table}>
              <Table2 aria-hidden="true" size={16} /> {table ? "Esconder a tabela" : "Ver hora a hora em tabela"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {table ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enterT }} exit={{ opacity: 0, transition: exitT }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col" className={styles.numCol}>Entraram bons</th>
                      <th scope="col" className={styles.numCol}>Entraram frios</th>
                      <th scope="col" className={styles.numCol}>Foram bons</th>
                      <th scope="col" className={styles.numCol}>Foram frios</th>
                      {report.hourly === "timeline" ? <th scope="col" className={styles.numCol}>Bons esperando</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {report.hours.map((hour) => {
                      const ranOut = hour.goodWaiting === 0 && hour.distributed.cold + hour.distributed.noReply > 0;
                      return (
                        <tr key={hour.startsAt} data-tone={ranOut ? "warning" : undefined}>
                          <td data-label="Hora"><span className={styles.cellMain}>{hour.label}</span></td>
                          <td data-label="Entraram bons" className={styles.numCol}>{n(hour.arrived.good)}</td>
                          <td data-label="Entraram frios" className={styles.numCol}>{n(hour.arrived.cold + hour.arrived.noReply)}</td>
                          <td data-label="Foram bons" className={styles.numCol}>{n(hour.distributed.good)}</td>
                          <td data-label="Foram frios" className={styles.numCol}>{n(hour.distributed.cold + hour.distributed.noReply)}</td>
                          {report.hourly === "timeline" ? <td data-label="Bons esperando" className={styles.numCol}>{hour.goodWaiting === 0 ? "0, acabaram" : n(hour.goodWaiting ?? 0)}</td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        {inversions.length ? (
          <p className={styles.note} data-tone="warning">
            <AlertTriangle aria-hidden="true" size={16} />
            Atenção: {inversions.map((queue) => `${queue.queue} mandou ${n(queue.weakWhileGoodWaiting)} frios com lead bom qualificado esperando na mesma fila`).join("; ")}. Aqui não faltou lead bom: vale revisar a distribuição.
          </p>
        ) : null}
      </Question>

      <Question number={4} title="E se não mandasse os frios? (estimativa)" help="Estimativa: tira os frios do que foi entregue e supõe que os bons seriam entregues igual.">
        <div className={styles.stats3}>
          <Stat index={0} label="Foram para os corretores" value={report.distributed.total} detail={`${n(report.distributed.good)} bons e ${n(sentWeak)} frios, ${n(report.brokers)} corretores`} />
          <Stat index={1} label="Sem os frios seriam (estimativa)" value={report.withoutWeak.distributed} detail={`${n(report.withoutWeak.removed)} leads a menos (${share(report.withoutWeak.removedShare)})`} tone="weak" />
          <LiteItem index={2} className={styles.stat}>
            <span className={styles.statLabel}>Média por corretor</span>
            <span className={styles.statValue}>
              {report.withoutWeak.perBrokerNow === null ? "sem dados" : <LiteNumber value={report.withoutWeak.perBrokerNow} kind="dec" />}
              <span className={styles.statArrow} aria-label="para">para</span>
              {report.withoutWeak.perBrokerWithout === null ? "sem dados" : <LiteNumber value={report.withoutWeak.perBrokerWithout} kind="dec" />}
            </span>
            <span className={styles.statDetail}>Hoje, e sem os frios</span>
          </LiteItem>
        </div>
        <div className={styles.split11}>
          {report.shifts.map((shift, index) => {
            const total = shift.distributedGood + shift.distributedWeak;
            return (
              <LiteItem key={shift.key} index={index} className={styles.mutedCard}>
                <h3 className={styles.cardTitleSm}>{shift.label}</h3>
                <p>Receberam <strong className={styles.strong}>{n(total)}</strong> leads: {n(shift.distributedGood)} bons e {n(shift.distributedWeak)} frios ({n(shift.brokers)} corretores).</p>
                <p className={styles.muted}>Sem os frios: <strong className={styles.strong}>{n(shift.distributedGood)}</strong> leads{shift.brokers ? `, ${(shift.distributedGood / shift.brokers).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por corretor` : ""}.</p>
              </LiteItem>
            );
          })}
        </div>
        <p className={styles.footnote}>Vendas vindas de leads frios no período: {n(report.converted.weak)}. De leads bons: {n(report.converted.good)}.</p>
      </Question>
    </div>
  );
}
