"use client";

/**
 * Aba "Funil" no visual Lite, cópia 1:1 do artifact "Qualidade dos leads e Funil da gestão" (27/11/2026): resumo,
 * Do anúncio à venda, Onde os leads estão agora, Por que foram perdidos, Testes da primeira mensagem, Qual mensagem
 * trouxe a resposta e Custo na Meta, com os dados reais de `getQualificationFunnel`. No celular segue o Celular.dc.html.
 */
import Link from "next/link";

import type { QualificationFunnel } from "@/features/qualification-turbo/funnel";

import q from "./qualidade-funil.module.css";
import { minutesLabel, money, n, noLeadsSince, pct, periodWords, plural } from "./format";

const ratio = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const enter = (index: number, base = 40) => ({ animationDelay: `${base + index * 40}ms` });
const width = (part: number, whole: number) => `${whole ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0}%`;
const NOW_TONE: Record<string, "action" | "warning" | "success" | "muted"> = { qualifying: "action", waiting: "warning", ready: "warning", broker: "action", cold: "muted", no_reply: "muted", noReply: "muted", out: "muted", unreachable: "muted", lost: "muted", converted: "success", sold: "success" };

/** Linha de detalhe de "Responderam": sem "resposta em sem respostas ainda" quando ninguém respondeu. */
export function repliedDetail(replied: number, medianMinutes: number | null) {
  if (!replied) return "Ninguém respondeu ainda";
  const leads = plural(replied, "lead", "leads");
  return medianMinutes === null ? leads : `${leads}, metade em até ${minutesLabel(medianMinutes)}`;
}

function money0(value: number | null) {
  return value === null ? null : money(value);
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
  const periodLabel = data.period === "today" ? "Hoje" : `Últimos ${data.period} dias`;
  const when = periodWords(data.period);
  const anyTouch = data.touches.some((touch) => touch.sent > 0);
  const maxTouch = Math.max(1, ...data.touches.map((touch) => touch.repliesAfter));
  const maxLoss = Math.max(1, ...data.lossReasons.map((row) => row.count));

  if (arrived === 0) {
    return (
      <section aria-label="Funil vazio" className={`${q.card} ${q.pad20}`} role="status">
        <h2 className={q.ttl}>{data.period === "today" ? "Nenhum lead chegou hoje" : "Nenhum lead chegou neste período"}</h2>
        <p className={q.help}>{data.period === "today" ? `${noLeadsSince(data.since, now)} O funil aparece quando o primeiro lead chegar.` : "Tente ampliar o período ou escolher outra fila."}</p>
        {data.period === "today" && widerHref ? <p className={q.zero} style={{ marginTop: 12 }}><Link href={widerHref} className={q.ghost}>Ver os últimos 7 dias</Link></p> : null}
      </section>
    );
  }

  const stats = [
    { label: "Leads que chegaram", short: "Chegaram", value: n(arrived), detail: `${periodLabel}, ${unitName ?? "todas as unidades"}` },
    { label: "Responderam à primeira mensagem", short: "Responderam", value: `${ratio(replied, arrived)}%`, detail: repliedDetail(replied, data.medianMinutesToReply) },
    { label: "Qualificados", short: "Qualificados", value: `${ratio(qualified, arrived)}%`, detail: qualified ? `${plural(qualified, "lead pronto", "leads prontos")} para o corretor` : "Nenhum lead pronto ainda" },
    { label: "Vendas", short: "Vendas", value: n(converted), detail: converted ? `${pct(converted, arrived)} dos leads que chegaram` : `Nenhuma venda ${when}` },
  ];
  const undelivered = sent && delivered < sent ? ` · ${plural(sent - delivered, "primeira mensagem não entregue", "primeiras mensagens não entregues")}` : "";
  const summary = `${plural(converted, "venda", "vendas")} de ${plural(arrived, "lead", "leads")} · ${pct(converted, arrived).replace("%", "")}%${undelivered}`;
  const stages = data.stages;
  const lastIndex = stages.length - 1;
  const cost = data.cost;
  const costs = cost ? [
    { label: cost.source === "estimate" ? "Investido (estimado)" : "Investido", value: money(cost.total) },
    { label: "Por lead", value: money0(arrived ? cost.total / arrived : null) ?? "Sem leads" },
    { label: "Por lead qualificado", value: money0(cost.perQualified) ?? `Sem qualificados ${when}` },
    { label: "Por venda", value: money0(converted ? cost.total / converted : null) ?? `Sem venda ${when}` },
  ] : [];

  return (
    <div className={q.stack}>
      <section aria-label="Resumo do período" className={q.grid4}>
        {stats.map((stat, index) => (
          <article key={stat.label} className={`${q.card} ${q.stat} ${q.in}`} style={enter(index)}>
            <h3 className={q.statLabel}><span className={q.desktopOnly}>{stat.label}</span><span className={q.phoneOnly}>{stat.short}</span></h3>
            <p className={`${q.statValue} ${q.num}`}>{stat.value}</p>
            <p className={q.statDetail}>{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className={`${q.card} ${q.funnelCard} ${q.in}`} aria-labelledby="f-funil" style={enter(0, 160)}>
        <div className={q.funnelHead}>
          <h2 id="f-funil" className={q.ttl}>Do anúncio à venda</h2>
          <span className={`${q.funnelSummary} ${q.num} ${q.desktopOnly}`}>{summary}</span>
        </div>
        <ol className={`${q.funnelList} ${q.desktopOnly}`}>
          {stages.map((stage, index) => {
            const share = arrived ? (stage.count / arrived) * 100 : 0;
            const previous = index ? stages[index - 1].count : null;
            const drop = previous ? Math.round((stage.count / previous) * 100) : null;
            const wide = share > 18;
            return (
              <li key={stage.key} className={`${q.funnelRow} ${q.in}`} style={enter(index, 200)}>
                <span className={q.funnelLabel}>{stage.label}</span>
                <span className={q.funnelTrack}>
                  <span
                    className={`${q.funnelFill} ${q.segFill}`}
                    style={{ width: `${Math.max(share, 6)}%`, background: index === lastIndex ? "var(--p-action)" : `color-mix(in oklab, var(--p-action) ${Math.max(30, 90 - index * 9)}%, white)`, animationDelay: `${200 + index * 40}ms` }}
                  >
                    <span className={`${q.funnelCount} ${q.num}`} style={{ color: wide ? "#fff" : "var(--p-foreground)" }}>{n(stage.count)}</span>
                  </span>
                </span>
                <span className={`${q.funnelRate} ${q.num}`} data-low={drop !== null && drop < 50 ? "true" : undefined}>{drop === null ? "100%" : `${drop}% da etapa anterior`}</span>
              </li>
            );
          })}
        </ol>
        <ol className={`${q.phoneOnly} ${q.phoneFunnel}`}>
          {stages.map((stage, index) => {
            const previous = index ? stages[index - 1].count : null;
            const drop = previous ? Math.round((stage.count / previous) * 100) : null;
            return (
              <li key={stage.key}>
                <span className={q.barHead}><span className={q.strong}>{stage.label}</span><span className={q.num}>{n(stage.count)} {drop !== null ? <span className={q.funnelRate} data-low={drop < 50 ? "true" : undefined}>· {drop}%</span> : null}</span></span>
                <span className={q.phoneFunnelTrack}><span className={`${q.fill} ${q.fillAction} ${q.segFill}`} style={{ width: `${Math.max(arrived ? (stage.count / arrived) * 100 : 0, 4)}%` }} /></span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={q.grid2}>
        <section className={`${q.card} ${q.pad20} ${q.in}`} aria-labelledby="f-agora" style={enter(0, 200)}>
          <h2 id="f-agora" className={q.ttl}>Onde os leads estão agora</h2>
          <p className={`${q.help} ${q.desktopOnly}`} style={{ marginBottom: 8 }}>Situação atual dos leads do período.</p>
          <div aria-label="Situação atual dos leads do período">
            {data.now.map((row) => (
              <div key={row.key} className={q.kv} title={row.hint}>
                <span className={q.kvLabel}><span className={q.dot} data-tone={NOW_TONE[row.key] === "action" ? undefined : NOW_TONE[row.key]} aria-hidden="true" />{row.label}</span>
                <span className={`${q.num} ${q.kvValue}`}>{n(row.count)} <span className={`${q.kvPct} ${q.desktopOnly}`}>{pct(row.count, arrived)}</span></span>
              </div>
            ))}
          </div>
        </section>
        <section className={`${q.card} ${q.pad20} ${q.in}`} aria-labelledby="f-perda" style={enter(0, 240)}>
          <h2 id="f-perda" className={q.ttl}><span className={q.desktopOnly}>Por que os leads foram perdidos</span><span className={q.phoneOnly}>Por que foram perdidos</span></h2>
          {data.lossReasons.length ? (
            <ul className={q.barList} aria-label="Motivos de perda">
              {data.lossReasons.map((row) => (
                <li key={row.label} className={q.barItem}>
                  <span className={q.barHead}><span>{row.label}</span><span className={`${q.num} ${q.barCount}`}>{n(row.count)}</span></span>
                  <span className={q.barTrack}><span className={`${q.fill} ${q.fillGrey} ${q.segFill}`} style={{ width: width(row.count, maxLoss) }} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={q.emptyText}>Nenhum lead do período foi marcado como perdido.</p>
          )}
        </section>
      </div>

      <div className={q.grid2wide}>
        <section className={`${q.card} ${q.tableCard} ${q.in}`} aria-labelledby="f-testes" style={enter(0, 280)}>
          <div className={q.tableHead}>
            <h2 id="f-testes" className={q.ttl}>Testes da primeira mensagem</h2>
            <p className={`${q.help} ${q.desktopOnly}`}>A faixa mostra a margem de erro da taxa de resposta.</p>
          </div>
          {data.variants.length ? (
            <>
              <div className={`${q.testHead} ${q.desktopOnly}`}><span>Mensagem</span><span className={q.r}>Enviadas</span><span>Responderam</span><span className={q.r}>Qualificados</span></div>
              <div className={q.desktopOnly} role="table" aria-label="Resultados das variantes da primeira mensagem">
                {data.variants.map((row) => (
                  <div key={`${row.approach}-${row.variant}`} className={q.testRow} role="row">
                    <span className={q.testName} role="cell"><span>{row.label}</span><span>{row.approach}</span></span>
                    <span className={`${q.num} ${q.r}`} role="cell">{n(row.sent)}</span>
                    <span className={q.rangeCell} role="cell" aria-label={`${Math.round(row.rate * 100)}%, entre ${Math.round(row.low * 100)} e ${Math.round(row.high * 100)}%`}>
                      <span className={q.rangeTrack} aria-hidden="true">
                        <span className={q.rangeBand} style={{ left: `${row.low * 100}%`, width: `${Math.max(0, row.high - row.low) * 100}%` }} />
                        <span className={q.rangeDot} style={{ left: `${row.rate * 100}%` }} />
                      </span>
                      <span className={`${q.num} ${q.rangeValue}`}>{Math.round(row.rate * 100)}%</span>
                    </span>
                    <span className={`${q.num} ${q.r}`} role="cell">{pct(row.qualified, row.sent)}</span>
                  </div>
                ))}
              </div>
              <div className={q.phoneOnly} style={{ padding: "0 16px" }}>
                {data.variants.map((row) => (
                  <div key={`${row.approach}-${row.variant}`} className={q.phoneTest}>
                    <span className={q.strong} style={{ fontSize: 14 }}>{row.label}</span>
                    <span className={q.statDetail}>{row.approach}</span>
                    <span className={q.num} style={{ fontSize: 14, color: "var(--p-text-secondary)" }}>{n(row.sent)} enviadas · {Math.round(row.rate * 100)}% responderam · {pct(row.qualified, row.sent)} qualificados</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className={q.emptyText} style={{ padding: "0 20px 12px" }}>Os resultados aparecem depois das primeiras mensagens enviadas pela qualificação turbo.</p>
          )}
        </section>
        <section className={`${q.card} ${q.pad20} ${q.in}`} aria-labelledby="f-toque" style={enter(0, 320)}>
          <h2 id="f-toque" className={q.ttl}>Qual mensagem trouxe a resposta</h2>
          <p className={`${q.help} ${q.desktopOnly}`}>Último toque enviado antes da primeira resposta do lead.</p>
          {anyTouch ? (
            <ul className={q.barList} aria-label="Respostas por mensagem enviada">
              {data.touches.map((row) => (
                <li key={row.touch} className={q.barItem}>
                  <span className={q.barHead}><span>{row.label} <span className={q.muted}>· {plural(row.sent, "enviada", "enviadas")}</span></span><span className={`${q.num} ${q.barCount}`}>{n(row.repliesAfter)}</span></span>
                  <span className={q.barTrack}><span className={`${q.fill} ${q.fillAction} ${q.segFill}`} style={{ width: width(row.repliesAfter, maxTouch) }} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={q.emptyText}>Nenhuma mensagem enviada {when}.</p>
          )}
        </section>
      </div>

      <section className={`${q.card} ${q.pad20} ${q.in}`} aria-labelledby="f-custo" style={enter(0, 360)}>
        <div className={q.costHead}>
          <h2 id="f-custo" className={q.ttl}>{cost?.source === "estimate" ? "Custo estimado na Meta" : "Custo na Meta"}</h2>
          {cost ? <span className={`${q.sectionAside} ${q.desktopOnly}`}>Da empresa toda, do período escolhido · marketing {money(cost.marketing)}, utilidade {money(cost.utility)}</span> : null}
        </div>
        {cost ? (
          <>
            <div className={`${q.grid4} ${q.desktopOnly}`}>
              {costs.map((row) => (
                <div key={row.label} className={q.mutedBox}>
                  <p className={q.statLabel}>{row.label}</p>
                  <p className={`${q.statValue} ${q.costValue} ${q.num}`}>{row.value}</p>
                </div>
              ))}
            </div>
            <div className={q.phoneOnly}>
              <div className={q.kvList}>
                {costs.map((row) => <div key={row.label} className={q.kv}><span>{row.label}</span><span className={`${q.num} ${q.kvValue}`}>{row.value}</span></div>)}
              </div>
            </div>
          </>
        ) : (
          <p className={q.emptyText} style={{ marginTop: 0 }}>O custo da Meta é da empresa toda. Com uma unidade escolhida ele fica escondido, porque o número da unidade não bateria com a conta da Meta.</p>
        )}
      </section>
    </div>
  );
}
