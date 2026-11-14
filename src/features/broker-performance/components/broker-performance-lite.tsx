"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useTransition, type ReactNode } from "react";

import { motionTokens } from "@/components/arc/motion-tokens";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { CurrencyCircleDollar, FileText, Handshake, Sparkle, Users } from "@/components/huge-icons";
import { LiteDelta, LiteNumber, LiteStaggerItem } from "@/components/lite/motion";

import { BROKER_PERFORMANCE_PERIODS, PERIOD_LABEL, type BrokerMetricCard, type BrokerPerformancePeriod, type BrokerPerformanceView } from "../domain";
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

function GoalRing({ percentage }: { percentage: number }) {
  const reduce = useReducedMotion();
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const offset = length * (1 - percentage / 100);
  return (
    <span className={styles.ring} role="img" aria-label={`${percentage}% da meta`}>
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
        <small>da meta</small>
      </span>
    </span>
  );
}

/** Barra do funil: cresce da esquerda, cada etapa um passo depois da anterior. Largura (não scaleX) para manter a ponta arredondada; são só três barras. */
function FunnelBar({ widthPercent, step }: { widthPercent: number; step: number }) {
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

function NumberCards({ view }: { view: BrokerPerformanceView }) {
  return (
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
  );
}

function GoalPanel({ goal }: { goal: NonNullable<BrokerPerformanceView["goal"]> }) {
  return (
    <section className={`${styles.panel} ${styles.raised} ${styles.goal}`} aria-labelledby="performance-goal-title">
      <GoalRing percentage={goal.percentage} />
      <div>
        <h2 id="performance-goal-title" className={styles.goalName}>{goal.name}</h2>
        <p className={styles.goalProgress}>{goal.currentLabel} de {goal.targetLabel}</p>
        {goal.pace ? <p className={styles.pace}>{goal.pace}</p> : null}
      </div>
    </section>
  );
}

function FunnelBody({ view }: { view: BrokerPerformanceView }) {
  if (view.empty) return <p className={styles.empty}>Quando chegarem leads neste período, o caminho até a venda aparece aqui.</p>;
  return (
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
  );
}

function Insight({ text }: { text: string }) {
  return (
    <p className={styles.insight}>
      <Sparkle size={18} weight="fill" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

function CarriersBody({ view }: { view: BrokerPerformanceView }) {
  if (view.carriers.length === 0) return <p className={styles.empty}>Nenhuma venda neste período.</p>;
  return (
    <ul className={styles.carrierList}>
      {view.carriers.map((carrier) => (
        <li key={carrier.name} className={styles.carrier}>
          <span className={styles.carrierName}>{carrier.name}</span>
          <span className={styles.carrierValue}>{carrier.sales} · {carrier.revenueLabel}</span>
        </li>
      ))}
    </ul>
  );
}

function Shortcuts() {
  return (
    <nav aria-label="Atalhos do desempenho" className={styles.links}>
      <Link href="/minha-fila" className={styles.link}>Ver meus leads</Link>
      <Link href="/plantoes" className={styles.link}>Ver plantões</Link>
    </nav>
  );
}

const PERIOD_SCOPE: Record<BrokerPerformancePeriod, string> = { hoje: "hoje", "7d": "nos últimos 7 dias", "30d": "nos últimos 30 dias" };
const RESULTS_TITLE: Record<BrokerPerformancePeriod, string> = { hoje: "Resultados de hoje", "7d": "Resultados dos últimos 7 dias", "30d": "Resultados dos últimos 30 dias" };

/** Uma linha de indicador: rótulo à esquerda, valor com unidade à direita. Sem dado, diz isso em vez de mostrar 0%. */
function Indicator({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div className={styles.indicator}>
      <dt className={styles.indicatorLabel}>
        <span>{label}</span>
        <small>{detail}</small>
      </dt>
      <dd className={value === null ? styles.indicatorEmpty : styles.indicatorValue}>
        {value === null ? "Sem dado" : <LiteNumber value={value} format="percent" countFromZero />}
      </dd>
    </div>
  );
}

/** Atendimento e conversão: os indicadores que o motor já entrega, o funil e a frase do período. */
function ServiceSection({ view }: { view: BrokerPerformanceView }) {
  const { firstContact, quoteRate, saleRate } = view.service;
  const scope = PERIOD_SCOPE[view.period];
  return (
    <section className={styles.section} aria-labelledby="performance-service-title" data-block="indicadores">
      <h2 id="performance-service-title" className={styles.sectionTitle}>Atendimento e conversão</h2>
      <dl className={`${styles.panel} ${styles.indicators}`}>
        <Indicator
          label="Primeiro contato no prazo"
          value={firstContact ? Math.round(firstContact.rate) : null}
          detail={firstContact ? `${firstContact.leads} ${firstContact.leads === 1 ? "lead medido" : "leads medidos"} ${scope}` : `Nenhum lead com prazo medido ${scope}`}
        />
        <Indicator label="Leads que viraram cotação" value={quoteRate} detail={quoteRate === null ? `Sem leads suficientes ${scope}` : scope} />
        <Indicator label="Cotações que viraram venda" value={saleRate} detail={saleRate === null ? `Sem cotações suficientes ${scope}` : scope} />
      </dl>
      <div className={styles.panel}>
        <h3 className={styles.subTitle}>Seu funil</h3>
        <FunnelBody view={view} />
      </div>
      {view.insight ? <Insight text={view.insight} /> : null}
    </section>
  );
}

export type BrokerPerformanceComposition = "classic" | "results";

/**
 * Desempenho do próprio corretor: período na URL (?periodo=), sem ranking nem comparação com a equipe.
 * `classic` mantém os seis blocos de antes. `results` (BROKER_NAV_REORG) organiza a página em período, resultados,
 * atendimento e conversão, metas e Minha jornada (o cartão chega pronto em `journey`; ranking e missões ficam na Jornada).
 */
export function BrokerPerformanceLite({
  view,
  composition = "classic",
  journey = null,
}: {
  view: BrokerPerformanceView;
  composition?: BrokerPerformanceComposition;
  journey?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function changePeriod(period: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("periodo", period);
    startTransition(() => router.push(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  if (composition === "results") {
    return (
      <div className={styles.page} aria-busy={pending} data-composition="results">
        <LiteStaggerItem index={0}>
          <header className={styles.header} data-block="periodo">
            <h1 className="lite-page-title">Desempenho</h1>
            <SegmentedControl label="Período" options={PERIOD_OPTIONS} value={view.period} onValueChange={changePeriod} className={styles.period} />
          </header>
        </LiteStaggerItem>

        <div className={styles.body}>
          <section className={styles.section} aria-labelledby="performance-numbers-title" data-block="resultados">
            <LiteStaggerItem index={1}>
              <h2 id="performance-numbers-title" className={styles.sectionTitle}>{RESULTS_TITLE[view.period]}</h2>
              <p className={styles.lead}>{view.summary}</p>
            </LiteStaggerItem>
            <NumberCards view={view} />
            <LiteStaggerItem index={5}>
              <div className={styles.panel}>
                <h3 className={styles.subTitle}>Vendas por operadora</h3>
                <CarriersBody view={view} />
              </div>
            </LiteStaggerItem>
          </section>

          <LiteStaggerItem index={6}>
            <ServiceSection view={view} />
          </LiteStaggerItem>

          <LiteStaggerItem index={7}>
            <section className={styles.section} aria-labelledby="performance-goals-title" data-block="metas">
              <h2 id="performance-goals-title" className={styles.sectionTitle}>Metas</h2>
              {view.goal ? (
                <GoalPanel goal={view.goal} />
              ) : (
                <p className={`${styles.panel} ${styles.empty}`}>Nenhuma meta ativa para você agora. Quando a gestão definir uma, o progresso aparece aqui.</p>
              )}
            </section>
          </LiteStaggerItem>

          {journey ? (
            <LiteStaggerItem index={8}>
              <div data-block="jornada">{journey}</div>
            </LiteStaggerItem>
          ) : null}

          <Shortcuts />
        </div>
      </div>
    );
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
          <NumberCards view={view} />
        </section>

        {view.goal ? (
          <LiteStaggerItem index={5}>
            <GoalPanel goal={view.goal} />
          </LiteStaggerItem>
        ) : null}

        <LiteStaggerItem index={6}>
          <section className={styles.panel} aria-labelledby="performance-funnel-title">
            <h2 id="performance-funnel-title" className={styles.sectionTitle}>Seu funil</h2>
            <FunnelBody view={view} />
          </section>
        </LiteStaggerItem>

        {view.insight ? (
          <LiteStaggerItem index={7}>
            <Insight text={view.insight} />
          </LiteStaggerItem>
        ) : null}

        <LiteStaggerItem index={7}>
          <section className={styles.panel} aria-labelledby="performance-carriers-title">
            <h2 id="performance-carriers-title" className={styles.sectionTitle}>Vendas por operadora</h2>
            <CarriersBody view={view} />
          </section>
        </LiteStaggerItem>

        <Shortcuts />
      </div>
    </div>
  );
}
