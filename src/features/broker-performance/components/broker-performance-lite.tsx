"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useTransition } from "react";

import { motionTokens } from "@/components/arc/motion-tokens";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { CurrencyCircleDollar, FileText, Handshake, Sparkle, Users } from "@/components/huge-icons";
import { LiteDelta, LiteNumber, LiteStaggerItem } from "@/components/lite/motion";

import { BROKER_PERFORMANCE_PERIODS, PERIOD_LABEL, type BrokerMetricCard, type BrokerPerformanceView } from "../domain";
import styles from "./broker-performance-lite.module.css";

const PERIOD_OPTIONS = BROKER_PERFORMANCE_PERIODS.map((value) => ({ value, label: PERIOD_LABEL[value] }));
const CARD_ICONS: Record<BrokerMetricCard["key"], typeof Users> = { leads: Users, quotes: FileText, sales: Handshake, revenue: CurrencyCircleDollar };

/**
 * Coreografia de entrada, só com tokens: a página cai em cascata (cabeçalho, quatro cartões, meta,
 * funil, frase, operadoras), os números contam do zero e, quando os cartões assentam, o anel da meta
 * enche e as barras do funil crescem uma depois da outra. Com movimento reduzido, tudo só aparece.
 */
const FILL_DELAY = motionTokens.duration.standard;
const BAR_STEP = motionTokens.stagger.line;

function CardIcon({ metric }: { metric: BrokerMetricCard["key"] }) {
  const Icon = CARD_ICONS[metric];
  return <Icon size={20} className={styles.cardIcon} aria-hidden="true" />;
}

function ChangeLine({ card }: { card: BrokerMetricCard }) {
  const { change, comparisonLabel } = card;
  if (!change) return <span className={styles.change}>Sem movimento para comparar</span>;
  if (change.kind === "flat") return <span className={styles.change}>Igual · {comparisonLabel}</span>;
  if (change.kind === "new") return <span className={`${styles.change} ${styles.up}`}>Novo · {comparisonLabel}</span>;
  return (
    <span className={styles.change}>
      <LiteDelta value={change.value * 100} />
      <span>{comparisonLabel}</span>
    </span>
  );
}

/** Anel de progresso do kit de desempenho (também usado na prévia do Diretor). */
export function GoalRing({ percentage, caption = "da meta" }: { percentage: number; caption?: string }) {
  const reduce = useReducedMotion();
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - percentage / 100);
  return (
    <span className={styles.ring} role="img" aria-label={`${percentage}% ${caption}`}>
      <svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} className={styles.ringTrack} />
        <motion.circle
          cx="50" cy="50" r={radius}
          className={styles.ringValue}
          strokeDasharray={length}
          initial={{ strokeDashoffset: reduce ? offset : length }}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.considered * 2, ease: [...motionTokens.ease.enter], delay: FILL_DELAY }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className={styles.ringCore} aria-hidden="true">
        <strong><LiteNumber value={percentage} format="percent" countFromZero /></strong>
        <small>{caption}</small>
      </span>
    </span>
  );
}

/** Barra do funil: cresce da esquerda, cada etapa um passo depois da anterior. Largura (não scaleX) para manter a ponta arredondada; são só três barras. */
export function FunnelBar({ widthPercent, step }: { widthPercent: number; step: number }) {
  const reduce = useReducedMotion();
  const width = `${widthPercent}%`;
  return (
    <span className={styles.barTrack} aria-hidden="true">
      <motion.span
        className={styles.bar}
        data-step={step}
        initial={{ width: reduce ? width : "0%" }}
        animate={{ width }}
        transition={reduce ? { duration: 0 } : { ...motionTokens.spring.morph, delay: FILL_DELAY + step * BAR_STEP }}
      />
    </span>
  );
}

/** Desempenho do próprio corretor: período na URL (?periodo=), seis blocos, sem ranking nem comparação com a equipe. */
export function BrokerPerformanceLite({ view }: { view: BrokerPerformanceView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function changePeriod(period: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("periodo", period);
    startTransition(() => router.push(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  return (
    <div className={styles.page} aria-busy={pending}>
      <LiteStaggerItem index={0}>
        <header className={styles.header}>
          <div>
            <h1 className="lite-page-title">Desempenho</h1>
            <p className="lite-page-subtitle">{view.summary}</p>
          </div>
          <SegmentedControl label="Período" options={PERIOD_OPTIONS} value={view.period} onValueChange={changePeriod} className={styles.period} />
        </header>
      </LiteStaggerItem>

      <div className={styles.body}>
        <section className={styles.section} aria-labelledby="performance-numbers-title">
          <LiteStaggerItem index={1}>
            <h2 id="performance-numbers-title" className={styles.sectionTitle}>Seus números</h2>
          </LiteStaggerItem>
          <dl className={styles.cards}>
            {view.cards.map((card, index) => (
              <LiteStaggerItem key={card.key} index={index + 1} className={styles.card}>
                <dt className={styles.cardTop}>
                  <span className={styles.cardLabel}>{card.label}</span>
                  <CardIcon metric={card.key} />
                </dt>
                <dd className={styles.cardValue}><LiteNumber value={card.value} format={card.format === "currency" ? "currency" : "integer"} decimals={0} countFromZero /></dd>
                <dd><ChangeLine card={card} /></dd>
              </LiteStaggerItem>
            ))}
          </dl>
        </section>

        {view.goal ? (
          <LiteStaggerItem index={5}>
            <section className={`${styles.panel} ${styles.raised} ${styles.goal}`} aria-labelledby="performance-goal-title">
              <GoalRing percentage={view.goal.percentage} />
              <div>
                <h2 id="performance-goal-title" className={styles.goalName}>{view.goal.name}</h2>
                <p className={styles.goalProgress}>{view.goal.currentLabel} de {view.goal.targetLabel}</p>
                {view.goal.pace ? <p className={styles.pace}>{view.goal.pace}</p> : null}
              </div>
            </section>
          </LiteStaggerItem>
        ) : null}

        <LiteStaggerItem index={6}>
          <section className={styles.panel} aria-labelledby="performance-funnel-title">
            <h2 id="performance-funnel-title" className={styles.sectionTitle}>Seu funil</h2>
            {view.empty ? (
              <p className={styles.empty}>Quando chegarem leads neste período, o caminho até a venda aparece aqui.</p>
            ) : (
              <>
                {view.funnel.stages.map((stage, index) => (
                  <div key={stage.key} className={styles.stage}>
                    <span className={styles.stageLabel}>{stage.label}</span>
                    <FunnelBar widthPercent={Math.max(stage.widthPercent, stage.value > 0 ? 4 : 0)} step={index} />
                    <span className={styles.stageValue}><LiteNumber value={stage.value} countFromZero /></span>
                  </div>
                ))}
                {view.funnel.note ? <p className={styles.note}>{view.funnel.note}</p> : null}
              </>
            )}
          </section>
        </LiteStaggerItem>

        {view.insight ? (
          <LiteStaggerItem index={7}>
            <p className={styles.insight}>
              <Sparkle size={18} weight="fill" aria-hidden="true" />
              <span>{view.insight}</span>
            </p>
          </LiteStaggerItem>
        ) : null}

        <LiteStaggerItem index={7}>
          <section className={styles.panel} aria-labelledby="performance-carriers-title">
            <h2 id="performance-carriers-title" className={styles.sectionTitle}>Vendas por operadora</h2>
            {view.carriers.length === 0 ? (
              <p className={styles.empty}>Nenhuma venda neste período.</p>
            ) : (
              <ul className={styles.carrierList}>
                {view.carriers.map((carrier) => (
                  <li key={carrier.name} className={styles.carrier}>
                    <span className={styles.carrierName}>{carrier.name}</span>
                    <span className={styles.carrierValue}>{carrier.sales} · {carrier.revenueLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </LiteStaggerItem>

        <nav aria-label="Atalhos do desempenho" className={styles.links}>
          <Link href="/minha-fila" className={styles.link}>Ver meus leads</Link>
          <Link href="/plantoes" className={styles.link}>Ver plantões</Link>
        </nav>
      </div>
    </div>
  );
}
