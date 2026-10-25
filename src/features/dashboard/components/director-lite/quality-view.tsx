"use client";

/**
 * "Qualidade dos leads" no visual Lite: a vista Simples (quatro perguntas do dono) com os dados reais
 * de `getSimpleLeadQualityReport`. A vista detalhada continua na tela antiga por enquanto.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Info, SearchX, Table2 } from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import type { SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";

import styles from "./director-lite.module.css";
import { noDataLabel, noLeadsSince, n, pct, periodWords, plural, ranOutLabel, share } from "./format";
import { hourAxis, tickEvery } from "./hour-axis";
import { enterT, exitT, LiteColumn, LiteItem, LiteNumber, LiteReveal } from "./motion";

/** Um número do grupo. `value` null = não dá para calcular: texto curto e sem a linha de comparação. */
function Stat({ label, value, detail, tone, index, kind = "int", empty }: { label: string; value: number | null; detail?: string; tone?: "good" | "weak"; index: number; kind?: "int" | "dec"; empty: string }) {
  return (
    <LiteItem index={index} className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      {value === null ? (
        <span className={styles.statEmpty}>{empty}</span>
      ) : (
        <>
          <LiteNumber value={value} kind={kind} className={`${styles.statValue} ${tone === "good" ? styles.good : tone === "weak" ? styles.weak : ""}`} />
          {detail ? <span className={styles.statDetail}>{detail}</span> : null}
        </>
      )}
    </LiteItem>
  );
}

/** Seção da página: título simples e uma linha de descrição (sem número em círculo). */
function Section({ title, children, help }: { title: string; children: ReactNode; help?: ReactNode }) {
  return (
    <LiteReveal as="section" className={styles.block} label={title}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {help ? <p className={styles.sectionDescription}>{help}</p> : null}
      </header>
      {children}
    </LiteReveal>
  );
}

/** Uma linha de estado zerado: o que aconteceu e, quando ajuda, o próximo passo. */
function ZeroLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.zeroLine} role="status">
      <p>{children}</p>
      {action}
    </div>
  );
}

function HourChart({ report, now }: { report: SimpleLeadQualityReportData; now?: Date | null }) {
  const axis = hourAxis(report, now);
  if (axis.every((hour) => hour.empty)) {
    return <p className={styles.chartEmpty}>Nenhum lead entrou {periodWords(report.period)}.</p>;
  }
  const max = Math.max(1, ...axis.map((hour) => Math.max(hour.good, hour.weak)));
  const every = tickEvery(axis.length);
  return (
    <div className={styles.hourChart}>
      <div className={styles.legend} aria-hidden="true">
        <span><span className={styles.legendSwatch} data-tone="success" />Entraram bons</span>
        <span><span className={styles.legendSwatch} data-tone="neutral" />Entraram frios</span>
        {report.hourly === "timeline" ? <span><span className={styles.legendSwatch} data-tone="warning" />Bons acabaram</span> : null}
      </div>
      <div className={styles.hourBars} role="img" aria-label={`Leads bons e frios que entraram por hora, de ${axis[0].label} a ${axis[axis.length - 1].label}`} data-hours={axis.length}>
        {axis.map((hour, index) => (
          <span key={hour.key} className={styles.hourSlot} data-ranout={hour.ranOut || undefined} data-empty={hour.empty || undefined} data-future={hour.future || undefined}>
            <span className={styles.hourPair}>
              <LiteColumn value={hour.good / max} delay={Math.min(index, 12) * 0.03} tone="success" label={`${hour.label}: ${n(hour.good)} bons`} />
              <LiteColumn value={hour.weak / max} delay={Math.min(index, 12) * 0.03} tone="neutral" label={`${hour.label}: ${n(hour.weak)} frios`} />
            </span>
            <span className={styles.hourTick}>{index % every === 0 ? hour.label : ""}</span>
          </span>
        ))}
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

/**
 * Barra da aba: Simples (esta tela) e os recursos que ainda só existem na tela antiga (Detalhada, fila, intervalo e
 * exportar). Cada um leva à tela antiga com o mesmo período (`legado=1` impede o retorno à versão Lite).
 */
export function QualityToolbar({ legacyHref, detailedHref }: { legacyHref: string; detailedHref: string }) {
  return (
    <nav aria-label="Vista e ferramentas da qualidade" className={styles.chipRow}>
      <span className={styles.chip} aria-current="true">Simples</span>
      <Link href={detailedHref} className={styles.chip}>Detalhada</Link>
      <Link href={legacyHref} className={styles.chip} title="Filtrar por fila na tela completa">Fila: todas</Link>
      <Link href={legacyHref} className={styles.chip} title="Escolher um intervalo na tela completa">Intervalo</Link>
      <Link href={legacyHref} className={styles.chip} title="Exportar na tela completa">Exportar</Link>
    </nav>
  );
}

/**
 * A vista Simples: entraram e bons, por fila, hora a hora e o que mudaria sem os frios. `unitName` null = todas as unidades.
 * `now` vem do servidor e fecha o eixo do gráfico na hora atual; `widerHref` é o próximo passo do dia zerado (7 dias).
 */
export function QualityView({ report, unitName, now, widerHref }: { report: SimpleLeadQualityReportData; unitName: string | null; now?: Date | null; widerHref?: string }) {
  const [table, setTable] = useState(false);
  const arrivedWeak = report.arrived.cold + report.arrived.noReply;
  const sentWeak = report.distributed.cold + report.distributed.noReply;
  const runOuts = report.byQueue.filter((queue) => queue.goodRanOut);
  const inversions = report.byQueue.filter((queue) => queue.weakWhileGoodWaiting > 0);
  const when = periodWords(report.period);
  const empty = noDataLabel(report.period);
  const today = report.period === "today";
  if (!report.arrived.total) {
    return (
      <div className={styles.card}>
        <div className={styles.cardEmpty}>
          <EmptyState
            icon={<SearchX aria-hidden="true" />}
            title={today ? "Nenhum lead entrou hoje" : "Nenhum lead neste período"}
            description={today ? `${noLeadsSince(report.window.since, now)} Os números aparecem quando o primeiro lead entrar.` : "Escolha outro período ou outra unidade."}
            action={today && widerHref ? <Link href={widerHref} className={styles.secondaryButton}>Ver os últimos 7 dias</Link> : undefined}
          />
        </div>
      </div>
    );
  }
  const scope = unitName ? `Unidade ${unitName}` : "Todas as unidades";
  const sent = report.distributed.total;
  return (
    <div className={styles.stack}>
      {report.truncated ? <p className={styles.note} data-tone="warning"><AlertTriangle aria-hidden="true" size={16} />Período muito longo: o relatório usa só os leads mais recentes. Escolha um período menor para ver tudo.</p> : null}
      <Section title="Quantos leads entraram e quantos são bons" help="Bom é quente ou morno validado. Lead de WhatsApp só conta como bom se o cliente respondeu a qualificação.">
        <div className={styles.stats4}>
          <Stat index={0} empty={empty} label="Entraram" value={report.arrived.total} detail={scope} />
          <Stat index={1} empty={empty} label="Bons (quentes e mornos)" value={report.arrived.good} detail={`${pct(report.arrived.good, report.arrived.total)} do que entrou`} tone="good" />
          <Stat index={2} empty={empty} label="Frios" value={arrivedWeak} detail={arrivedWeak ? `${pct(arrivedWeak, report.arrived.total)}: ${plural(report.arrived.cold, "frio", "frios")} e ${n(report.arrived.noReply)} sem resposta no WhatsApp` : "Nenhum lead frio"} tone="weak" />
          <Stat index={3} empty={empty} label="Descartados ou em qualificação" value={report.arrived.other} detail={report.arrived.other ? `${pct(report.arrived.other, report.arrived.total)} do que entrou` : undefined} />
        </div>
      </Section>

      <Section title="Por fila" help={report.byQueue.length === 1 ? "Só uma fila recebeu leads." : undefined}>
        <div className={styles.card}>
          <div className={styles.tableScroll}>
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
                  <tr key={queue.queueId ?? queue.queue}>
                    <td data-label="Fila"><span className={styles.cellMain}>{queue.queue}</span></td>
                    <td data-label="Reter frios"><span className={styles.badge} data-tone={queue.holdColdLeads ? "success" : "neutral"}>{queue.holdColdLeads ? "Ligada" : "Desligada"}</span></td>
                    <td data-label="Entraram" className={styles.numCol}>{n(queue.arrived)}</td>
                    <td data-label="Bons" className={styles.numCol}><span>{n(queue.good)} <span className={styles.muted}>({pct(queue.good, queue.arrived)})</span></span></td>
                    <td data-label="Frios" className={styles.numCol}>{n(queue.weak)}</td>
                    <td data-label="Distribuídos" className={styles.numCol}>{n(queue.distributed)}</td>
                    <td data-label="Frios distribuídos" className={styles.numCol}>{n(queue.distributedWeak)}</td>
                    <td data-label="Bons acabaram" className={styles.numCol}>{report.hourly === "timeline" ? (queue.goodRanOut ? ranOutLabel(queue.goodRanOut, report.period) : null) ?? <span className={styles.muted}>Não acabaram</span> : <span className={styles.muted}>Escolha um dia</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section
        title="Hora a hora: quando os bons acabaram"
        help={
          report.hourly === "timeline"
            ? runOuts.length
              ? `${runOuts.map((queue) => `${queue.queue}: os bons acabaram às ${ranOutLabel(queue.goodRanOut ?? "", report.period)}`).join("; ")}. Dali em diante só havia frios para entregar.`
              : sent
                ? "Em nenhuma hora os bons acabaram: sempre havia lead bom qualificado esperando."
                : `Nenhum lead foi distribuído ${when}, então os bons ainda não acabaram.`
            : "Período longo: cada coluna soma a mesma hora de todos os dias. A hora em que os bons acabam aparece escolhendo um dia só."
        }
      >
        <div className={styles.card}>
          <div className={styles.cardBodyTop}>
            <HourChart report={report} now={now} />
            <button type="button" className={styles.ghostButton} onClick={() => setTable((was) => !was)} aria-expanded={table}>
              <Table2 aria-hidden="true" size={16} /> {table ? "Esconder a tabela" : "Ver hora a hora em tabela"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {table ? (
              <motion.div className={styles.tableScroll} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enterT }} exit={{ opacity: 0, transition: exitT }}>
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
      </Section>

      <Section title="E se não mandasse os frios? (estimativa)" help="Tira os frios do que foi entregue e supõe que os bons seriam entregues igual.">
        {sent ? (
          <>
            <div className={styles.stats3}>
              <Stat index={0} empty={empty} label="Foram para os corretores" value={sent} detail={`${n(report.distributed.good)} bons e ${n(sentWeak)} frios, ${plural(report.brokers, "corretor", "corretores")}`} />
              <Stat index={1} empty={empty} label="Sem os frios seriam" value={report.withoutWeak.distributed} detail={report.withoutWeak.removed ? `${plural(report.withoutWeak.removed, "lead a menos", "leads a menos")} (${share(report.withoutWeak.removedShare)})` : "Nenhum frio foi entregue"} tone="weak" />
              <LiteItem index={2} className={styles.stat}>
                <span className={styles.statLabel}>Média por corretor, agora e sem os frios</span>
                {report.withoutWeak.perBrokerNow === null || report.withoutWeak.perBrokerWithout === null ? (
                  <span className={styles.statEmpty}>{empty}</span>
                ) : (
                  <span className={styles.statValue}>
                    <LiteNumber value={report.withoutWeak.perBrokerNow} kind="dec" />
                    <span className={styles.statArrow} aria-label="para">para</span>
                    <LiteNumber value={report.withoutWeak.perBrokerWithout} kind="dec" />
                  </span>
                )}
              </LiteItem>
            </div>
            <div className={styles.stats2}>
              {report.shifts.map((shift, index) => {
                const total = shift.distributedGood + shift.distributedWeak;
                return (
                  <LiteItem key={shift.key} index={index} className={styles.stat}>
                    <h3 className={styles.statLabel}>{shift.label}</h3>
                    {total ? (
                      <>
                        <p className={styles.shiftLine}>Receberam <strong className={styles.strong}>{n(total)}</strong> leads: {n(shift.distributedGood)} bons e {n(shift.distributedWeak)} frios ({plural(shift.brokers, "corretor", "corretores")}).</p>
                        <p className={styles.statDetail}>Sem os frios: {n(shift.distributedGood)} leads{shift.brokers ? `, ${(shift.distributedGood / shift.brokers).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por corretor` : ""}.</p>
                      </>
                    ) : (
                      <p className={styles.statEmpty}>Nenhum lead distribuído neste turno.</p>
                    )}
                  </LiteItem>
                );
              })}
            </div>
          </>
        ) : (
          <ZeroLine action={<Link href="/leads/distribuicao?view=plantao" className={styles.textLink}>Ver plantões <ArrowRight aria-hidden="true" size={14} /></Link>}>
            Nenhum lead foi para os corretores {when}. A estimativa aparece com a primeira distribuição.
          </ZeroLine>
        )}
        <p className={styles.footnote}>Vendas vindas de leads frios {when}: {n(report.converted.weak)}. De leads bons: {n(report.converted.good)}.</p>
      </Section>
    </div>
  );
}
