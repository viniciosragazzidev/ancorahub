"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { ArrowsClockwise, CalendarCheck, Clock, Sparkle, UserCheck, Users, WhatsappLogo } from "@/components/huge-icons";
import { LiteNumber, LiteStaggerItem } from "@/components/lite/motion";
import { FunnelBar, GoalRing } from "@/features/broker-performance/components/broker-performance-lite";
import styles from "@/features/broker-performance/components/broker-performance-lite.module.css";
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import local from "./director-performance.module.css";

/**
 * Prévia: o painel essencial do Diretor (leads por fila, temperatura, requalificação, plantões e WhatsApp)
 * no estilo do Desempenho Lite. Sem dados de venda por enquanto (pedido do Vinicios, 2026-10-26).
 */

const PERIODS: Array<{ value: string; label: string; period: OverviewPeriod }> = [
  { value: "hoje", label: "Hoje", period: "today" },
  { value: "7d", label: "7 dias", period: "7d" },
  { value: "30d", label: "30 dias", period: "30d" },
];

const integer = new Intl.NumberFormat("pt-BR");
const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

type Card = { key: string; label: string; value: number; context: string; Icon: typeof Users };

function insightFor(data: EssentialDashboard): string | null {
  const rows = data.queues.rows.filter((row) => row.arrived >= 5);
  if (rows.length === 0) return null;
  const coldest = [...rows].sort((a, b) => b.cold / b.arrived - a.cold / a.arrived)[0];
  const coldRate = share(coldest.cold, coldest.arrived);
  const leader = [...rows].sort((a, b) => b.arrived - a.arrived)[0];
  if (coldRate >= 40) return `${coldest.name} tem ${coldRate}% de leads frios. ${leader.name === coldest.name ? "É também a fila com mais entrada." : `${leader.name} segue com a maior entrada.`}`;
  return `${leader.name} concentra ${share(leader.arrived, data.queues.totals.arrived)}% dos leads que entraram.`;
}

export function DirectorPerformance({ data, period }: { data: EssentialDashboard; period: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { totals, rows, label } = data.queues;

  function changePeriod(value: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("periodo", value);
    startTransition(() => router.push(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  const cards: Card[] = [
    { key: "arrived", label: "Entraram", value: totals.arrived, context: label, Icon: Users },
    { key: "qualified", label: "Qualificados", value: totals.qualified, context: `${share(totals.qualified, totals.arrived)}% do que entrou`, Icon: UserCheck },
    { key: "pending", label: "Em qualificação", value: totals.inQualification, context: `${share(totals.inQualification, totals.arrived)}% ainda sem temperatura`, Icon: Clock },
    { key: "cold", label: "Frios", value: totals.cold, context: `${integer.format(totals.requalification.attempts)} tentativas de requalificação`, Icon: ArrowsClockwise },
  ];
  const stages = [
    { key: "arrived", label: "Entraram", value: totals.arrived },
    { key: "qualified", label: "Qualificados", value: totals.qualified },
    { key: "hot", label: "Quentes", value: totals.hot },
  ];
  const top = Math.max(...stages.map((stage) => stage.value), 1);
  const topQueue = Math.max(...rows.map((row) => row.arrived), 1);
  const qualificationRate = share(totals.qualified, totals.arrived);
  const insight = insightFor(data);
  const { whatsapp } = data;

  return (
    <div className={styles.page} aria-busy={pending}>
      <LiteStaggerItem index={0}>
        <header className={styles.header}>
          <div>
            {data.firstName ? <p className={local.eyebrow}>Olá, {data.firstName}</p> : null}
            <h1 className="lite-page-title">Visão da operação</h1>
            <p className="lite-page-subtitle">{totals.arrived ? `${integer.format(totals.arrived)} leads entraram ${label}.` : `Nenhum lead entrou ${label}.`}</p>
          </div>
          <SegmentedControl label="Período" options={PERIODS} value={period} onValueChange={changePeriod} className={styles.period} />
        </header>
      </LiteStaggerItem>

      <div className={styles.body}>
        <section className={styles.section} aria-labelledby="director-numbers-title">
          <LiteStaggerItem index={1}>
            <h2 id="director-numbers-title" className={styles.sectionTitle}>Leads da empresa</h2>
          </LiteStaggerItem>
          <dl className={styles.cards}>
            {cards.map(({ key, label: cardLabel, value, context, Icon }, index) => (
              <LiteStaggerItem key={key} index={index + 1} className={styles.card}>
                <dt className={styles.cardTop}>
                  <span className={styles.cardLabel}>{cardLabel}</span>
                  <Icon size={20} className={styles.cardIcon} aria-hidden="true" />
                </dt>
                <dd className={styles.cardValue}><LiteNumber value={value} countFromZero /></dd>
                <dd className={styles.change}>{context}</dd>
              </LiteStaggerItem>
            ))}
          </dl>
        </section>

        <LiteStaggerItem index={5}>
          <section className={`${styles.panel} ${styles.raised} ${styles.goal}`} aria-labelledby="director-rate-title">
            <GoalRing percentage={qualificationRate} caption="qualificados" />
            <div>
              <h2 id="director-rate-title" className={styles.goalName}>Taxa de qualificação</h2>
              <p className={styles.goalProgress}>{integer.format(totals.qualified)} de {integer.format(totals.arrived)} leads viraram quentes ou mornos</p>
              <p className={styles.pace}>{integer.format(totals.hot)} quentes · {integer.format(totals.warm)} mornos</p>
            </div>
          </section>
        </LiteStaggerItem>

        <LiteStaggerItem index={6}>
          <section className={styles.panel} aria-labelledby="director-funnel-title">
            <h2 id="director-funnel-title" className={styles.sectionTitle}>Funil de qualificação</h2>
            {totals.arrived === 0 ? (
              <p className={styles.empty}>Quando entrarem leads neste período, o funil aparece aqui.</p>
            ) : (
              <>
                {stages.map((stage, index) => (
                  <div key={stage.key} className={styles.stage}>
                    <span className={styles.stageLabel}>{stage.label}</span>
                    <FunnelBar widthPercent={Math.max(Math.round((stage.value / top) * 100), stage.value > 0 ? 4 : 0)} step={index} />
                    <span className={styles.stageValue}><LiteNumber value={stage.value} countFromZero /></span>
                  </div>
                ))}
                <p className={styles.note}>Frios: {integer.format(totals.cold)}. Requalificação: {totals.requalification.once} com 1 tentativa, {totals.requalification.twice} com 2 e {totals.requalification.threePlus} com 3 ou mais.</p>
              </>
            )}
          </section>
        </LiteStaggerItem>

        {insight ? (
          <LiteStaggerItem index={7}>
            <p className={styles.insight}>
              <Sparkle size={18} weight="fill" aria-hidden="true" />
              <span>{insight}</span>
            </p>
          </LiteStaggerItem>
        ) : null}

        <LiteStaggerItem index={7}>
          <section className={styles.panel} aria-labelledby="director-queues-title">
            <h2 id="director-queues-title" className={styles.sectionTitle}>Leads por fila</h2>
            {rows.length === 0 ? (
              <p className={styles.empty}>Nenhum lead entrou {label}.</p>
            ) : (
              <ul className={styles.carrierList}>
                {rows.map((row, index) => (
                  <li key={row.id ?? row.name} className={local.listRow}>
                    <span className={styles.carrier}>
                      <span className={styles.carrierName}>{row.name}</span>
                      <span className={styles.carrierValue}>{row.arrived} entraram · {row.qualified} qualificados · {row.cold} frios</span>
                    </span>
                    <FunnelBar widthPercent={Math.max(Math.round((row.arrived / topQueue) * 100), 4)} step={Math.min(index, 2)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </LiteStaggerItem>

        <LiteStaggerItem index={7}>
          <section className={styles.panel} aria-labelledby="director-duties-title">
            <div className={styles.cardTop}>
              <h2 id="director-duties-title" className={styles.sectionTitle}>Plantões acontecendo agora</h2>
              <CalendarCheck size={20} className={styles.cardIcon} aria-hidden="true" />
            </div>
            {data.duties.running.length === 0 ? (
              <p className={styles.empty}>Nenhum plantão acontecendo agora.</p>
            ) : (
              <ul className={styles.carrierList}>
                {data.duties.running.map((duty) => (
                  <li key={duty.scheduleId} className={local.stackedRow}>
                    <span className={styles.carrierName}>{duty.name}</span>
                    <span className={local.detail}>
                      {duty.available} disponíveis · {duty.distributed} distribuídos · {duty.activeBrokers}/{duty.brokerCount} corretores
                      {duty.belowMinimum ? <span className={local.warn}> · abaixo do mínimo</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </LiteStaggerItem>

        <LiteStaggerItem index={7}>
          <section className={styles.panel} aria-labelledby="director-whatsapp-title">
            <div className={styles.cardTop}>
              <h2 id="director-whatsapp-title" className={styles.sectionTitle}>WhatsApp dos corretores</h2>
              <WhatsappLogo size={20} className={styles.cardIcon} aria-hidden="true" />
            </div>
            <p className={styles.note}>{whatsapp.connected} de {whatsapp.total} corretores conectados, {whatsapp.label}.</p>
            <ul className={styles.carrierList}>
              <li className={styles.carrier}><span className={styles.carrierName}>Recebidos</span><span className={styles.carrierValue}>{whatsapp.received}</span></li>
              <li className={styles.carrier}><span className={styles.carrierName}>Respondendo</span><span className={styles.carrierValue}>{whatsapp.responding} · {whatsapp.responseRate}%</span></li>
              <li className={styles.carrier}><span className={styles.carrierName}>Atendimentos ativos</span><span className={styles.carrierValue}>{whatsapp.active}</span></li>
            </ul>
          </section>
        </LiteStaggerItem>
      </div>
    </div>
  );
}
