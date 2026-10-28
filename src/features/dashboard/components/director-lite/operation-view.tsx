"use client";

/**
 * Aba "Visão da operação" no estilo do Desempenho Lite (2026-10-26): os mesmos dados do painel essencial
 * (leads por fila, temperatura, requalificação, plantões agora e WhatsApp), em cartões com ícone, anel e
 * barras, com entrada em cascata. Sem dados de venda por enquanto. Período e unidade ficam no cabeçalho da aba.
 */
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ContextualIllustration } from "@/components/illustrations/contextual-illustration";

import { motionTokens as m } from "@/components/arc/motion-tokens";
import { ArrowsClockwise, CalendarCheck, Clock, Sparkle, UserCheck, Users, WhatsappLogo } from "@/components/huge-icons";
import kit from "@/features/broker-performance/components/broker-performance-lite.module.css";
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";

import local from "./operation-view.module.css";
import { n, plural } from "./format";
import { LiteItem, LiteNumber, useReduce } from "./motion";

/** Atraso para anel e barras encherem depois que os cartões assentam. */
const FILL_DELAY = m.duration.standard;

/**
 * Movimento segue o contrato do painel do Diretor: só opacidade na entrada (sem deslocar layout) e,
 * com movimento reduzido do sistema ou do site, tudo aparece pronto.
 */
function Ring({ percentage }: { percentage: number }) {
  const reduce = useReduce();
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - percentage / 100);
  return (
    <span className={kit.ring} role="img" aria-label={`${percentage}% qualificados`}>
      <svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} className={kit.ringTrack} />
        <motion.circle
          cx="50" cy="50" r={radius}
          className={kit.ringValue}
          strokeDasharray={length}
          initial={{ strokeDashoffset: reduce ? offset : length }}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { duration: m.duration.considered * 2, ease: [...m.ease.enter], delay: FILL_DELAY }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className={kit.ringCore} aria-hidden="true">
        <strong><LiteNumber value={percentage} kind="pct" /></strong>
        <small>qualificados</small>
      </span>
    </span>
  );
}

/** Barra que cresce da esquerda, cada uma um passo depois da anterior. */
function Bar({ widthPercent, step }: { widthPercent: number; step: number }) {
  const reduce = useReduce();
  const width = `${widthPercent}%`;
  return (
    <span className={kit.barTrack} aria-hidden="true">
      <motion.span
        className={kit.bar}
        data-step={step}
        initial={{ width: reduce ? width : "0%" }}
        animate={{ width }}
        transition={reduce ? { duration: 0 } : { ...m.spring.morph, delay: FILL_DELAY + step * m.stagger.line }}
      />
    </span>
  );
}

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

export function OperationView({ data, canOpenConversations = true }: { data: EssentialDashboard; canOpenConversations?: boolean }) {
  const { totals, rows, label } = data.queues;
  const { whatsapp, duties } = data;
  const cards = [
    { key: "arrived", label: "Entraram", value: totals.arrived, context: label, Icon: Users },
    { key: "qualified", label: "Qualificados", value: totals.qualified, context: `${share(totals.qualified, totals.arrived)}% do que entrou`, Icon: UserCheck },
    { key: "pending", label: "Em qualificação", value: totals.inQualification, context: `${share(totals.inQualification, totals.arrived)}% ainda sem temperatura`, Icon: Clock },
    { key: "cold", label: "Frios", value: totals.cold, context: plural(totals.requalification.attempts, "tentativa de requalificação", "tentativas de requalificação"), Icon: ArrowsClockwise },
  ];
  const stages = [
    { key: "arrived", label: "Entraram", value: totals.arrived },
    { key: "qualified", label: "Qualificados", value: totals.qualified },
    { key: "hot", label: "Quentes", value: totals.hot },
  ];
  const topStage = Math.max(...stages.map((stage) => stage.value), 1);
  const topQueue = Math.max(...rows.map((row) => row.arrived), 1);
  const insight = operationInsight(data);
  const empty = totals.arrived === 0;

  return (
    <div className={kit.body}>
      <section className={kit.section} aria-labelledby="operation-numbers-title">
        <LiteItem index={0}>
          <h2 id="operation-numbers-title" className={kit.sectionTitle}>Leads {label}</h2>
        </LiteItem>
        <dl className={kit.cards}>
          {cards.map(({ key, label: cardLabel, value, context, Icon }, index) => (
            <LiteItem key={key} index={index + 1} className={kit.card}>
              <dt className={kit.cardTop}>
                <span className={kit.cardLabel}>{cardLabel}</span>
                <Icon size={20} className={kit.cardIcon} aria-hidden="true" />
              </dt>
              <dd className={kit.cardValue}><LiteNumber value={value} /></dd>
              <dd className={kit.change}>{context}</dd>
            </LiteItem>
          ))}
        </dl>
      </section>

      <LiteItem index={5}>
        <section className={`${kit.panel} ${kit.raised} ${kit.goal}`} aria-labelledby="operation-rate-title">
          <Ring percentage={share(totals.qualified, totals.arrived)} />
          <div>
            <h2 id="operation-rate-title" className={kit.goalName}>Taxa de qualificação</h2>
            <p className={kit.goalProgress}>{empty ? `Nenhum lead entrou ${label}.` : `${n(totals.qualified)} de ${n(totals.arrived)} leads viraram quentes ou mornos.`}</p>
            {empty ? null : <p className={kit.pace}>{plural(totals.hot, "quente", "quentes")} · {plural(totals.warm, "morno", "mornos")}</p>}
          </div>
        </section>
      </LiteItem>

      <LiteItem index={6}>
        <section className={kit.panel} aria-labelledby="operation-funnel-title">
          <h2 id="operation-funnel-title" className={kit.sectionTitle}>Funil de qualificação</h2>
          {empty ? (
            <p className={kit.empty}>Quando um lead entrar, o funil aparece aqui.</p>
          ) : (
            <>
              {stages.map((stage, index) => (
                <div key={stage.key} className={kit.stage}>
                  <span className={kit.stageLabel}>{stage.label}</span>
                  <Bar widthPercent={Math.max(Math.round((stage.value / topStage) * 100), stage.value > 0 ? 4 : 0)} step={index} />
                  <span className={kit.stageValue}><LiteNumber value={stage.value} /></span>
                </div>
              ))}
              <p className={kit.note}>
                {plural(totals.requalification.attempts, "tentativa", "tentativas")} de requalificação. {plural(totals.requalification.coldLeads, "frio", "frios")}: {n(totals.requalification.once)} com 1, {n(totals.requalification.twice)} com 2, {n(totals.requalification.threePlus)} com 3+.
              </p>
            </>
          )}
        </section>
      </LiteItem>

      {insight ? (
        <LiteItem index={7}>
          <p className={kit.insight}>
            <Sparkle size={18} weight="fill" aria-hidden="true" />
            <span>{insight}</span>
          </p>
        </LiteItem>
      ) : null}

      <LiteItem index={7}>
        <section className={kit.panel} aria-labelledby="operation-queues-title">
          <div className={kit.cardTop}>
            <h2 id="operation-queues-title" className={kit.sectionTitle}>Leads por fila</h2>
            <ContextualIllustration name="connections" size="sm" />
          </div>
          {empty ? (
            <p className={kit.empty}>Nenhum lead entrou {label}. Quando um lead entrar, ele aparece aqui, separado por fila.</p>
          ) : (
            <ul className={kit.carrierList}>
              {rows.map((row, index) => (
                <li key={row.id ?? row.name} className={local.queueRow}>
                  <span className={kit.carrier}>
                    <span className={kit.carrierName}>{row.name}</span>
                    <span className={kit.carrierValue}>{n(row.arrived)} entraram · {n(row.qualified)} qualificados · {n(row.cold)} frios</span>
                  </span>
                  <Bar widthPercent={Math.max(Math.round((row.arrived / topQueue) * 100), 4)} step={Math.min(index, 2)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </LiteItem>

      <LiteItem index={7}>
        <section className={kit.panel} aria-labelledby="operation-duties-title">
          <div className={kit.cardTop}>
            <div>
              <h2 id="operation-duties-title" className={kit.sectionTitle}>Plantões acontecendo agora</h2>
              <p className={kit.note}>{duties.running.length ? `${plural(duties.running.length, "plantão ativo", "plantões ativos")} neste momento.` : "Nenhum plantão ativo neste momento."}</p>
            </div>
            <ContextualIllustration name="calendar" size="sm" fallback={<CalendarCheck size={20} className={kit.cardIcon} aria-hidden="true" />} />
          </div>
          {duties.running.length ? (
            <ul className={kit.carrierList}>
              {duties.running.map((duty) => (
                <li key={duty.scheduleId} className={local.stackedRow}>
                  <Link href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className={local.rowLink}>
                    <span className={kit.carrierName}>{duty.name}</span>
                    <span className={local.time}>{duty.startsAt} às {duty.endsAt}</span>
                  </Link>
                  <span className={local.detail}>
                    {n(duty.available)} disponíveis · {n(duty.distributed)} distribuídos ·{" "}
                    <span data-warn={duty.belowMinimum ? "true" : undefined} className={duty.belowMinimum ? local.warn : undefined}>{duty.activeBrokers}/{duty.brokerCount} corretores{duty.belowMinimum ? ", abaixo do mínimo" : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={local.stackedRow}>
              {duties.next ? <p className={local.detail}>Próximo: {duties.next.name}, {duties.next.dutyDate.slice(8, 10)}/{duties.next.dutyDate.slice(5, 7)} às {duties.next.startsAt}.</p> : null}
              <Link href="/leads/distribuicao?view=plantao" className={kit.link}>Ver plantões <ArrowRight aria-hidden="true" size={14} /></Link>
            </div>
          )}
        </section>
      </LiteItem>

      <LiteItem index={7}>
        <section className={kit.panel} aria-labelledby="operation-whatsapp-title">
          <div className={kit.cardTop}>
            <div>
              <h2 id="operation-whatsapp-title" className={kit.sectionTitle}>WhatsApp dos corretores</h2>
              <p className={kit.note}>
                {whatsapp.connected === 0
                  ? whatsapp.total
                    ? `Nenhum dos ${n(whatsapp.total)} corretores conectou o WhatsApp pessoal ainda.`
                    : "Nenhum corretor ativo para mostrar."
                  : `${n(whatsapp.connected)} de ${n(whatsapp.total)} ${whatsapp.total === 1 ? "corretor conectou" : "corretores conectaram"} o WhatsApp pessoal, ${whatsapp.label}.`}
              </p>
            </div>
            <ContextualIllustration name="conversation" size="sm" fallback={<WhatsappLogo size={20} className={kit.cardIcon} aria-hidden="true" />} />
          </div>
          {whatsapp.connected > 0 ? (
            <>
              <dl className={local.figures}>
                <div><dt>Recebidos</dt><dd><LiteNumber value={whatsapp.received} /></dd></div>
                <div><dt>Respondendo · {whatsapp.responseRate}%</dt><dd><LiteNumber value={whatsapp.responding} /></dd></div>
                <div><dt>Atendimentos ativos</dt><dd><LiteNumber value={whatsapp.active} /></dd></div>
              </dl>
              {whatsapp.brokers.length ? (
                <ul className={kit.carrierList} aria-label="Corretores conectados, com atendimentos ativos">
                  {whatsapp.brokers.map((broker) => {
                    const body = (
                      <>
                        <span className={kit.carrierName}>{broker.name}</span>
                        <span className={kit.carrierValue}>{plural(broker.active, "ativo", "ativos")} · {n(broker.responding)} de {n(broker.received)} respondendo</span>
                      </>
                    );
                    return (
                      <li key={broker.id}>
                        {canOpenConversations ? (
                          <Link href={`/conversas?tab=leads&brokerId=${encodeURIComponent(broker.id)}`} className={`${kit.carrier} ${local.rowLink}`} title={`Ver conversas de ${broker.name}`}>{body}</Link>
                        ) : (
                          <div className={kit.carrier}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={kit.empty}>Nenhum atendimento ativo agora nos WhatsApp conectados.</p>
              )}
            </>
          ) : null}
        </section>
      </LiteItem>
    </div>
  );
}
