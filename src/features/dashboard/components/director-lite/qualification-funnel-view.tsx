"use client";

import Link from "next/link";
import { motion, type Transition } from "motion/react";
import { Funnel, Info } from "lucide-react";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens as m } from "@/components/arc/motion-tokens";
import type { QualificationFunnel } from "@/features/qualification-turbo/funnel";

import styles from "./director-lite.module.css";
import { LiteBar, LiteItem, LiteNumber, LiteReveal, useReduce } from "./motion";
import { minutesLabel, n, noLeadsSince, pct, periodWords, plural } from "./format";

const enterT: Transition = { duration: m.duration.standard, ease: [...m.ease.enter] };
const fadeT: Transition = { duration: m.duration.instant };

const ratio = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

function Stat({ label, value, kind = "int", detail, index }: { label: string; value: number; kind?: "int" | "pct"; detail?: string; index: number }) {
  return (
    <LiteItem index={index} className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <LiteNumber value={value} kind={kind} className={styles.statValue} />
      {detail ? <span className={styles.statDetail}>{detail}</span> : null}
    </LiteItem>
  );
}

function FunnelBars({ stages }: { stages: QualificationFunnel["stages"] }) {
  const first = stages[0]?.count ?? 0;
  return (
    <ol className={styles.funnel}>
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1].count : null;
        return (
          <LiteItem as="li" key={stage.key} index={index} className={styles.funnelRow}>
            <span className={styles.funnelLabel}>{stage.label}</span>
            <LiteBar value={first ? stage.count / first : 0} delay={index * 0.03} className={styles.funnelTrack} />
            <span className={styles.funnelValue}>
              <LiteNumber value={stage.count} className={styles.rowNumber} />
              {previous !== null ? <span className={styles.muted}>{pct(stage.count, previous)} da etapa</span> : <span className={styles.muted}>base</span>}
            </span>
          </LiteItem>
        );
      })}
    </ol>
  );
}

function Interval({ rate, low, high }: { rate: number; low: number; high: number }) {
  const reduce = useReduce();
  return (
    <span className={styles.interval} aria-label={`${Math.round(rate * 100)}%, entre ${Math.round(low * 100)} e ${Math.round(high * 100)}%`}>
      <span className={styles.intervalLine} aria-hidden="true">
        <motion.span
          className={styles.intervalRange}
          style={{ left: `${low * 100}%`, width: `${Math.max(0, high - low) * 100}%` }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true }}
          transition={reduce ? fadeT : enterT}
        />
        <span className={styles.intervalDot} style={{ left: `${rate * 100}%` }} />
      </span>
      <span className={styles.intervalText}><strong>{Math.round(rate * 100)}%</strong> <span className={styles.muted}>({Math.round(low * 100)} a {Math.round(high * 100)}%)</span></span>
    </span>
  );
}

/** Linha de detalhe de "Responderam": sem "resposta em sem respostas ainda" quando ninguém respondeu. */
export function repliedDetail(replied: number, medianMinutes: number | null) {
  if (!replied) return "Ninguém respondeu ainda";
  const leads = plural(replied, "lead", "leads");
  return medianMinutes === null ? leads : `${leads}, resposta em ${minutesLabel(medianMinutes)} (mediana)`;
}

/** `widerHref` é o próximo passo do dia sem leads (a mesma aba nos últimos 7 dias). */
export function QualificationFunnelView({ data, unitName, widerHref, now }: { data: QualificationFunnel; unitName: string | null; widerHref?: string; now?: Date | null }) {
  const byKey = new Map(data.stages.map((stage) => [stage.key, stage.count]));
  const arrived = byKey.get("arrived") ?? 0;
  const replied = byKey.get("replied") ?? 0;
  const qualified = byKey.get("qualified") ?? 0;
  const converted = byKey.get("converted") ?? 0;
  const delivered = byKey.get("delivered") ?? 0;
  const sent = byKey.get("sent") ?? 0;
  const maxTouch = Math.max(1, ...data.touches.map((touch) => touch.repliesAfter));
  const maxLoss = Math.max(1, ...data.lossReasons.map((row) => row.count));
  const periodDescription = data.period === "today" ? "hoje" : `nos últimos ${data.period} dias`;
  const periodLabel = data.period === "today" ? "Hoje" : `Últimos ${data.period} dias`;
  const when = periodWords(data.period);
  const anyTouch = data.touches.some((touch) => touch.sent > 0);

  if (arrived === 0) {
    return (
      <section aria-label="Funil vazio" className={`${styles.card} ${styles.cardEmpty}`} role="status">
        <EmptyState
          icon={<Funnel aria-hidden="true" />}
          title={data.period === "today" ? "Nenhum lead chegou hoje" : "Nenhum lead chegou neste período"}
          description={data.period === "today" ? `${noLeadsSince(data.since, now)} O funil aparece quando o primeiro lead chegar.` : "Tente ampliar o período ou escolher outra unidade."}
          action={data.period === "today" && widerHref ? <Link href={widerHref} className={styles.secondaryButton}>Ver os últimos 7 dias</Link> : undefined}
        />
      </section>
    );
  }

  return (
    <div className={styles.stack}>
      <section aria-label="Resumo do período" className={styles.stats4}>
        <Stat index={0} label="Leads que chegaram" value={arrived} detail={`${periodLabel}${unitName ? `, ${unitName}` : ""}`} />
        <Stat index={1} label="Responderam à primeira mensagem" value={ratio(replied, arrived)} kind="pct" detail={repliedDetail(replied, data.medianMinutesToReply)} />
        <Stat index={2} label="Qualificados" value={ratio(qualified, arrived)} kind="pct" detail={qualified ? `${plural(qualified, "lead pronto", "leads prontos")} para o corretor` : "Nenhum lead pronto ainda"} />
        <Stat index={3} label="Vendas" value={converted} detail={converted ? `${pct(converted, arrived)} dos leads que chegaram` : `Nenhuma venda ${when}`} />
      </section>

      <>
          <div className={styles.split32}>
            <LiteReveal as="section" className={styles.card} label="Do anúncio à venda">
              <header className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Do anúncio à venda</h2>
                  <p className={styles.cardDescription}>
                    Os mesmos leads que chegaram {periodDescription}, etapa por etapa.
                    {sent && delivered < sent ? ` ${plural(sent - delivered, "primeira mensagem não foi entregue", "primeiras mensagens não foram entregues")} pela Meta.` : ""}
                  </p>
                </div>
              </header>
              <div className={styles.cardBody}><FunnelBars stages={data.stages} /></div>
            </LiteReveal>

            <LiteReveal as="section" className={styles.card} label="Onde os leads estão agora" delay={m.stagger.item}>
              <header className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Onde os leads estão agora</h2>
                  <p className={styles.cardDescription}>Situação atual dos leads do período.</p>
                </div>
              </header>
              <ul className={styles.rows} aria-label="Situação atual dos leads do período">
                {data.now.map((row, index) => (
                  <LiteItem as="li" key={row.key} index={index} className={styles.plainRow}>
                    <span className={styles.dutyText}>
                      <span className={styles.rowTitle}>{row.label}</span>
                      <span className={styles.muted}>{row.hint}</span>
                    </span>
                    <LiteNumber value={row.count} className={styles.rowNumber} />
                  </LiteItem>
                ))}
              </ul>
            </LiteReveal>
          </div>

          <div className={styles.split11}>
            <LiteReveal as="section" className={styles.card} label="Testes da primeira mensagem">
              <header className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Testes da primeira mensagem</h2>
                  <p className={styles.cardDescription}>Cada lead recebe uma variante e sempre a mesma. Com 50 envios por variante, o sistema passa a usar mais a que tem mais respostas.</p>
                </div>
              </header>
              {data.variants.length ? (
                <table className={styles.table} aria-label="Resultados das variantes da primeira mensagem">
                  <thead>
                    <tr>
                      <th scope="col">Mensagem</th>
                      <th scope="col" className={styles.numCol}>Enviadas</th>
                      <th scope="col">Responderam</th>
                      <th scope="col" className={styles.numCol}>Qualificados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.variants.map((row) => (
                      <tr key={`${row.approach}-${row.variant}`}>
                        <td data-label="Mensagem"><span className={styles.cellMain}>{row.label}</span><span className={styles.muted}>{row.approach}</span></td>
                        <td data-label="Enviadas" className={styles.numCol}><LiteNumber value={row.sent} /></td>
                        <td data-label="Responderam"><Interval rate={row.rate} low={row.low} high={row.high} /></td>
                        <td data-label="Qualificados" className={styles.numCol}>{pct(row.qualified, row.sent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={styles.cardEmptyText}>Os resultados aparecem depois das primeiras mensagens enviadas pela qualificação turbo.</p>
              )}
            </LiteReveal>

            <LiteReveal as="section" className={styles.card} label="Qual mensagem trouxe a resposta" delay={m.stagger.item}>
              <header className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Qual mensagem trouxe a resposta</h2>
                  <p className={styles.cardDescription}>Último toque enviado antes da primeira resposta do lead.</p>
                </div>
              </header>
              {anyTouch ? <ul className={styles.barList} aria-label="Respostas por mensagem enviada">
                {data.touches.map((row, index) => (
                  <li key={row.touch} className={styles.barRow}>
                    <span className={styles.barHead}>
                      <span>{row.label}</span>
                      <span className={styles.tabular}><span className={styles.muted}>{n(row.sent)} enviadas,</span> <strong className={styles.strong}>{plural(row.repliesAfter, "resposta", "respostas")}</strong></span>
                    </span>
                    <LiteBar value={row.repliesAfter / maxTouch} delay={index * 0.03} />
                  </li>
                ))}
              </ul> : <p className={styles.cardEmptyText}>Nenhuma mensagem enviada {when}.</p>}
            </LiteReveal>
          </div>

          <div className={styles.split11}>
            <LiteReveal as="section" className={styles.card} label="Por que os leads foram perdidos">
              <header className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Por que os leads foram perdidos</h2>
                  <p className={styles.cardDescription}>Motivo informado pelo corretor ou confirmado na sugestão da IA.</p>
                </div>
              </header>
              {data.lossReasons.length ? (
                <ul className={styles.barList} aria-label="Motivos de perda">
                  {data.lossReasons.map((row, index) => (
                    <li key={row.label} className={styles.barRow}>
                      <span className={styles.barHead}><span>{row.label}</span><LiteNumber value={row.count} className={styles.rowNumber} /></span>
                      <LiteBar value={row.count / maxLoss} delay={index * 0.03} tone="neutral" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.cardEmptyText}>Nenhum lead do período foi marcado como perdido.</p>
              )}
            </LiteReveal>

            <LiteReveal as="section" className={styles.card} label="Custo na Meta" delay={m.stagger.item}>
              <header className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{data.cost?.source === "estimate" ? "Custo estimado na Meta" : "Custo na Meta"}</h2>
                  <p className={styles.cardDescription}>
                    {data.cost?.source === "estimate"
                      ? "Templates entregues a leads no período, pela tabela da Meta de 1/10/2026: marketing R$ 0,32 e utilidade R$ 0,035 por mensagem."
                      : "Mensagens cobradas pela Meta no período (dado de cada envio), na tabela de 1/10/2026: marketing R$ 0,32 e utilidade ou atendimento R$ 0,035."}
                  </p>
                </div>
              </header>
              {data.cost ? (
                <div className={styles.costGrid}>
                  <span className={`${styles.stat} ${styles.costMain}`}>
                    <span className={styles.statLabel}>Total {data.cost.source === "estimate" ? "estimado" : "no período"}</span>
                    <LiteNumber value={data.cost.total} kind="brl" className={styles.statValue} />
                    <span className={styles.statDetail}>{plural(data.cost.templatesDelivered, "mensagem cobrada", "mensagens cobradas")}</span>
                  </span>
                  <span className={styles.stat}><span className={styles.statLabel}>Marketing</span><LiteNumber value={data.cost.marketing} kind="brl" className={styles.miniValue} /></span>
                  <span className={styles.stat}><span className={styles.statLabel}>Utilidade</span><LiteNumber value={data.cost.utility} kind="brl" className={styles.miniValue} /></span>
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Por lead qualificado</span>
                    {data.cost.perQualified === null ? <span className={styles.statEmpty}>Sem qualificados {when}</span> : <LiteNumber value={data.cost.perQualified} kind="brl" className={styles.miniValue} />}
                  </span>
                </div>
              ) : (
                <p className={styles.note}><Info aria-hidden="true" size={16} /> O custo da Meta é da empresa toda. Com uma unidade escolhida ele fica escondido, porque o número da unidade não bateria com a conta da Meta.</p>
              )}
            </LiteReveal>
          </div>
      </>
    </div>
  );
}
