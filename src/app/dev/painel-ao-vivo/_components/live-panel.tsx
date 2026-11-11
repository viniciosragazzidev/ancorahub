"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion, type Transition } from "motion/react";
import { ArrowDown, ArrowUp, Moon, MoonStar, Sun, Sunset, UserCheck, Zap } from "lucide-react";

import { AnimatedCounter } from "@/components/arc/animated-counter/animated-counter";
import { motionTokens as m } from "@/components/arc/motion-tokens";

import {
  FILA_COLUMNS,
  LIVE_EXAMPLE,
  ORIGEM_KEYS,
  applyEvent,
  averagePerBroker,
  nextEvent,
  percentChange,
  sumOrigens,
  totalLeads,
  type LiveData,
  type LiveEvent,
  type OrigemKey,
  type Plantao,
  type Turno,
  type TurnoKey,
} from "./data";
import styles from "../painel.module.css";

const enter: Transition = { duration: m.duration.considered, ease: [...m.ease.enter] };
const TURNO_ICON: Record<TurnoKey, typeof Sun> = { manha: Sun, tarde: Sunset, noite: Moon, extra: MoonStar };
const FILA_BY_KEY = Object.fromEntries(FILA_COLUMNS.map((column) => [column.key, column])) as Record<OrigemKey, (typeof FILA_COLUMNS)[number]>;
const sumAll = (origens: Record<OrigemKey, number>) => ORIGEM_KEYS.reduce((sum, key) => sum + origens[key], 0);

/** Suposições: o que este exemplo usa e o design system do Diretor Lite não cobre. Aparecem na tela. */
const ASSUMPTIONS = [
  "Números de destaque maiores que a escala de texto (máx. 48px no Diretor): crescem com a altura da tela, até 128px, para ler de longe ou na TV.",
  "Indicador \"Ao vivo\" com ponto pulsando em --success: o kit de movimento só tem o pulso único de atenção.",
  "Comparação com \"ontem neste horário\": a regra exata (mesmo horário, mesma unidade) fica para a implementação.",
  "Aviso de lead novo reaproveita o aviso escuro do corretor (DS Lite 5.10) em pílula, fora do chat; no celular aparece embaixo.",
  "Chegada de lead: o número dá um pulo curto (escala 1,08) e a célula da fila acende; o kit prevê 1,04 para atenção.",
  "Corretores desenhados como pontos (um por pessoa), com o azul de série em dois tons, como no gráfico de barras.",
  "No celular a página rola na vertical; sem rolagem vale para computador e TV.",
];

type Flash = { id: number; turno?: TurnoKey; origem?: OrigemKey | null; plantaoId: string; kind: LiveEvent["kind"] };
type Notice = { id: number; title: string; detail: string; kind: LiveEvent["kind"] };

export function LivePanel({ intervalMs, openAssumptions }: { intervalMs: number; openAssumptions: boolean }) {
  const reduce = Boolean(useReducedMotion());
  const [data, setData] = useState<LiveData>(LIVE_EXAMPLE);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(openAssumptions);
  const step = useRef(0);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Simulação: um acontecimento a cada intervalo (lead novo numa fila ou presença confirmada).
  useEffect(() => {
    if (intervalMs <= 0) return;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const event = nextEvent(dataRef.current, step.current++);
      if (!event) return;
      const plantao = dataRef.current.plantoes.find((item) => item.id === event.plantaoId);
      setData((current) => applyEvent(current, event));
      setFlash({ id: step.current, plantaoId: event.plantaoId, turno: event.kind === "lead" ? event.turno : undefined, origem: event.kind === "lead" ? event.origem : undefined, kind: event.kind });
      setNotice(event.kind === "lead"
        ? { id: step.current, kind: "lead", title: event.origem ? `Lead novo na fila ${FILA_BY_KEY[event.origem].label}` : "Lead novo de outra origem", detail: event.origem ? FILA_BY_KEY[event.origem].queue : "indicação" }
        : { id: step.current, kind: "presenca", title: `${event.broker} confirmou presença`, detail: plantao ? `plantão ${plantao.name}` : "" });
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setNotice(null), 3600);
    };
    const first = setTimeout(tick, Math.min(3500, intervalMs));
    const every = setInterval(tick, intervalMs);
    return () => { clearTimeout(first); clearInterval(every); clearTimeout(noticeTimer); };
  }, [intervalMs]);

  const total = totalLeads(data.turnos);
  const origens = sumOrigens(data.turnos);
  const others = total - sumAll(origens);
  const change = percentChange(total, data.yesterdaySameTime);
  const running = data.plantoes.filter((plantao) => plantao.state === "agora");
  const receiving = running.reduce((sum, plantao) => sum + plantao.recebendo, 0);
  const scheduled = running.reduce((sum, plantao) => sum + plantao.escalados, 0);
  const confirmed = running.reduce((sum, plantao) => sum + plantao.confirmaram, 0);
  const average = averagePerBroker(data.plantoes);
  const leadFlash = flash?.kind === "lead" ? flash.id : null;
  const presenceFlash = flash?.kind === "presenca" ? flash.id : null;

  const rise = (index: number) => (reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: m.duration.instant } }
    : { initial: { opacity: 0, y: m.distance.md }, animate: { opacity: 1, y: 0 }, transition: { ...enter, delay: 0.06 + index * 0.04 } });

  return (
    <div className={`arc-venancor ${styles.page}`} data-skin="diretor">
      <motion.header className={styles.header} {...rise(0)}>
        <div>
          <h1 className={styles.title}>Como está a operação hoje</h1>
          <p className={styles.subtitle}>
            <span className={styles.live}><span className={styles.liveDot} aria-hidden />Ao vivo</span>
            <span aria-hidden>·</span>
            <span>{data.dateLabel}</span>
            <span aria-hidden>·</span>
            <Clock start={data.startClock} />
          </p>
        </div>
        <button type="button" className={styles.assumptionsToggle} aria-expanded={showAssumptions} onClick={() => setShowAssumptions((open) => !open)}>
          Dados de exemplo · {ASSUMPTIONS.length} suposições de design
        </button>
      </motion.header>

      <section className={styles.hero} aria-label="Resumo do dia">
        <motion.article className={styles.card} {...rise(1)}>
          <FlashRing id={leadFlash} reduce={reduce} />
          <h2 className={styles.cardLabel}>Leads recebidos hoje</h2>
          <div className={styles.bigRow}>
            <Bump id={leadFlash} reduce={reduce} className={styles.big}><AnimatedCounter value={total} locale="pt-BR" animateOnView /></Bump>
            <PlusOne id={leadFlash} reduce={reduce} />
          </div>
          {change !== null ? (
            <p className={`${styles.delta} ${change >= 0 ? styles.deltaUp : styles.deltaDown}`}>
              {change >= 0 ? <ArrowUp aria-hidden size={16} /> : <ArrowDown aria-hidden size={16} />}
              {Math.abs(change)}% vs. ontem neste horário
            </p>
          ) : null}
        </motion.article>

        <motion.article className={styles.card} {...rise(2)}>
          <FlashRing id={presenceFlash} reduce={reduce} />
          <h2 className={styles.cardLabel}>Corretores recebendo agora</h2>
          <div className={styles.bigRow}>
            <Bump id={presenceFlash} reduce={reduce} className={styles.big}><AnimatedCounter value={receiving} locale="pt-BR" animateOnView /></Bump>
            <span className={styles.bigOf}>de {scheduled} escalados</span>
          </div>
          <p className={styles.cardNote}>
            {confirmed} confirmaram presença{scheduled - confirmed > 0 ? ` · ${scheduled - confirmed} ainda não` : " · todos confirmaram"}
          </p>
        </motion.article>

        <motion.article className={styles.card} {...rise(3)}>
          <h2 className={styles.cardLabel}>Média de leads por corretor</h2>
          <div className={styles.bigRow}>
            <span className={styles.big}><AnimatedCounter value={average} decimals={1} locale="pt-BR" animateOnView /></span>
            <span className={styles.bigOf}>leads cada</span>
          </div>
          <p className={styles.cardNote}>Ontem neste horário: {data.yesterdayAverage.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}</p>
        </motion.article>
      </section>

      <div className={styles.bottom}>
        <motion.section className={styles.panel} aria-labelledby="leads-title" {...rise(4)}>
          <header className={styles.panelHeader}>
            <h2 id="leads-title" className={styles.panelTitle}>Leads de hoje</h2>
          </header>

          <p className={styles.sectionLabel}>Por turno</p>
          <ul className={styles.turnoStrip}>
            {data.turnos.map((turno) => (
              <TurnoBlock key={turno.key} turno={turno} reduce={reduce} flashId={flash?.kind === "lead" && flash.turno === turno.key ? flash.id : null} />
            ))}
          </ul>

          <p className={styles.sectionLabel}>Por fila</p>
          <div className={styles.filaGroups}>
            {(["Tatiana", "Renan"] as const).map((group) => {
              const columns = FILA_COLUMNS.filter((column) => column.group === group);
              const groupTotal = columns.reduce((sum, column) => sum + origens[column.key], 0);
              const lit = columns.some((column) => column.key === flash?.origem);
              return (
                <div key={group} className={styles.filaGroup}>
                  <p className={styles.filaGroupName}>
                    {group}
                    <span className={lit ? styles.filaGroupTotalLit : styles.filaGroupTotal}>
                      <Bump id={lit ? flash?.id ?? null : null} reduce={reduce}><AnimatedCounter value={groupTotal} locale="pt-BR" animateOnView /></Bump> leads
                    </span>
                  </p>
                  <div className={styles.filaTiles} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                    {columns.map((column) => (
                      <FilaTile key={column.key} column={column} turnos={data.turnos} total={origens[column.key]} reduce={reduce} flashId={flash?.origem === column.key ? flash.id : null} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {others > 0 ? <p className={styles.filaNote}>Mais {others} leads de outras origens (indicação, leads frios).</p> : null}
        </motion.section>

        <motion.section className={styles.panel} aria-labelledby="plantoes-title" {...rise(5)}>
          <header className={styles.panelHeader}>
            <h2 id="plantoes-title" className={styles.panelTitle}>Corretores por plantão</h2>
            <ul className={styles.legend} aria-label="Legenda">
              <li><span className={`${styles.dot} ${styles.dotOn}`} aria-hidden />Recebendo</li>
              <li><span className={`${styles.dot} ${styles.dotConfirmed}`} aria-hidden />Confirmou</li>
              <li><span className={`${styles.dot} ${styles.dotOff}`} aria-hidden />Não confirmou</li>
            </ul>
          </header>
          <div className={styles.plantaoHead} aria-hidden>
            <span>Plantão</span><span>Corretores</span><span className={styles.alignEnd}>Recebendo</span>
          </div>
          <ul className={styles.plantoes}>
            {data.plantoes.map((plantao, index) => (
              <PlantaoRow key={plantao.id} plantao={plantao} index={index} reduce={reduce} flashId={flash?.plantaoId === plantao.id ? flash.id : null} />
            ))}
          </ul>
        </motion.section>
      </div>

      <LiveNotice notice={notice} reduce={reduce} />

      <AnimatePresence>
        {showAssumptions ? (
          <motion.aside
            className={styles.assumptions}
            aria-label="Suposições de design"
            initial={{ opacity: 0, y: reduce ? 0 : m.distance.md }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : m.distance.sm, transition: { duration: m.duration.exit } }}
            transition={enter}
          >
            <p className={styles.assumptionsTitle}>Suposições (fora dos tokens do Diretor Lite)</p>
            <ol>
              {ASSUMPTIONS.map((text) => <li key={text}>{text}</li>)}
            </ol>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TurnoBlock({ turno, reduce, flashId }: { turno: Turno; reduce: boolean; flashId: number | null }) {
  const Icon = TURNO_ICON[turno.key];
  const later = turno.state === "depois";
  return (
    <li className={styles.turnoBlock} data-state={turno.state} aria-label={later ? `${turno.label}: começa às ${turno.startsAt}` : `${turno.label}: ${turno.leads} leads`}>
      <FlashRing id={flashId} reduce={reduce} soft />
      <p className={styles.turnoBlockName}>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
        {turno.label}
        {turno.state === "agora" ? <span className={styles.nowPill}><span className={styles.liveDotBlue} aria-hidden />Agora</span> : null}
      </p>
      {later ? (
        <p className={styles.turnoBlockLater}>começa às {turno.startsAt}</p>
      ) : (
        <p className={styles.turnoBlockNumber}><Bump id={flashId} reduce={reduce}><AnimatedCounter value={turno.leads} locale="pt-BR" animateOnView /></Bump></p>
      )}
    </li>
  );
}

/** Uma fila: total do dia grande e, embaixo, quanto veio em cada turno que já começou. */
function FilaTile({ column, turnos, total, reduce, flashId }: { column: (typeof FILA_COLUMNS)[number]; turnos: Turno[]; total: number; reduce: boolean; flashId: number | null }) {
  const started = turnos.filter((turno) => turno.state !== "depois");
  return (
    <div className={styles.filaTile} data-lit={flashId !== null ? "" : undefined} aria-label={`${column.queue}: ${total} leads hoje`}>
      <FlashRing id={flashId} reduce={reduce} />
      <p className={styles.filaTileName}>{column.tile}</p>
      <p className={styles.filaTileNumber}><Bump id={flashId} reduce={reduce}><AnimatedCounter value={total} locale="pt-BR" animateOnView /></Bump></p>
      <p className={styles.filaTileSplit}>
        {started.map((turno) => <span key={turno.key}>{turno.label.toLowerCase()} {turno.origens[column.key]}</span>)}
      </p>
    </div>
  );
}

function PlantaoRow({ plantao, index, reduce, flashId }: { plantao: Plantao; index: number; reduce: boolean; flashId: number | null }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSettled(true), 1500); return () => clearTimeout(timer); }, []);
  const dots = useMemo(() => Array.from({ length: plantao.escalados }, (_, i) => (
    plantao.state !== "agora" ? (i < plantao.confirmaram ? "done" : "off") : i < plantao.recebendo ? "on" : i < plantao.confirmaram ? "confirmed" : "off"
  )), [plantao]);
  const status = plantao.state === "agora" ? null : plantao.state === "encerrado" ? `Encerrado · ${plantao.confirmaram} vieram` : `Começa às ${plantao.hours.slice(0, 5)}`;
  return (
    <li className={styles.plantao} data-state={plantao.state}>
      <FlashRing id={flashId} reduce={reduce} soft />
      <div className={styles.plantaoName}>
        <p>{plantao.name}</p>
        <p className={styles.plantaoHours}>{status ?? plantao.hours}</p>
      </div>
      <div className={styles.dots} role="img" aria-label={`${plantao.escalados} escalados, ${plantao.confirmaram} confirmaram, ${plantao.recebendo} recebendo agora`}>
        {dots.map((kind, i) => (
          // A chave inclui o estado: quando um corretor confirma, o ponto dele entra de novo com um pulo.
          <motion.span
            key={`${i}-${kind}`}
            className={`${styles.dot} ${styles.dotBig} ${kind === "on" ? styles.dotOn : kind === "confirmed" ? styles.dotConfirmed : kind === "done" ? styles.dotDone : styles.dotOff}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce
              ? { duration: m.duration.instant }
              : { type: "spring", visualDuration: 0.36, bounce: 0.4, delay: !settled ? 0.25 + index * 0.05 + Math.min(i, 15) * m.stagger.char : 0 }}
          />
        ))}
      </div>
      <p className={`${styles.plantaoNumber} ${styles.alignEnd}`}>
        {plantao.state === "agora" ? (
          <>
            <Bump id={flashId} reduce={reduce}><AnimatedCounter value={plantao.recebendo} locale="pt-BR" animateOnView /></Bump>
            <span className={styles.plantaoOf}>/{plantao.escalados}</span>
          </>
        ) : <span className={styles.plantaoMuted}>{plantao.escalados} escalados</span>}
      </p>
    </li>
  );
}

/** Pulo curto do número quando o valor muda por um acontecimento ao vivo (nada com movimento reduzido). */
function Bump({ id, reduce, className, children }: { id: number | null; reduce: boolean; className?: string; children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  useEffect(() => {
    if (id === null || reduce || !scope.current) return;
    animate(scope.current, { scale: [1, 1.08, 1] }, { duration: 0.55, ease: [...m.ease.standard] });
  }, [id, reduce, animate, scope]);
  return <span ref={scope} className={`${styles.bump} ${className ?? ""}`}>{children}</span>;
}

/** Destaque de chegada: um anel azul suave que aparece e some uma vez (só opacidade com movimento reduzido). */
function FlashRing({ id, reduce, soft }: { id: number | null; reduce: boolean; soft?: boolean }) {
  return (
    <AnimatePresence>
      {id !== null ? (
        <motion.span
          key={id}
          className={soft ? styles.flashSoft : styles.flash}
          aria-hidden
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: reduce ? m.duration.considered : 1.8, ease: [...m.ease.standard] }}
        />
      ) : null}
    </AnimatePresence>
  );
}

function PlusOne({ id, reduce }: { id: number | null; reduce: boolean }) {
  return (
    <AnimatePresence>
      {id !== null ? (
        <motion.span
          key={id}
          className={styles.plusOne}
          aria-hidden
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: m.distance.sm }}
          animate={reduce ? { opacity: [0, 1, 1, 0] } : { opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 1], y: [m.distance.sm, 0, 0, -m.distance.lg] }}
          transition={{ duration: 2, times: [0, 0.12, 0.8, 1], ease: [...m.ease.standard] }}
        >
          +1
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function LiveNotice({ notice, reduce }: { notice: Notice | null; reduce: boolean }) {
  return (
    <div className={styles.noticeSlot} role="status" aria-live="polite">
      <AnimatePresence>
        {notice ? (
          <motion.div
            key={notice.id}
            className={styles.notice}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, transition: { duration: 0.22, ease: [...m.ease.exit] } }}
            transition={reduce ? { duration: m.duration.instant } : { type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
          >
            <span className={styles.noticeIcon} aria-hidden>{notice.kind === "lead" ? <Zap size={16} /> : <UserCheck size={16} />}</span>
            <span className={styles.noticeText}>
              <strong>{notice.title}</strong>
              <span className={styles.noticeDetail}>{notice.detail}</span>
            </span>
            <span className={styles.noticeTime}>agora</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Relógio simulado: abre no horário do exemplo e anda em tempo real (servidor e cliente começam iguais). */
function Clock({ start }: { start: { hour: number; minute: number } }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const begun = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - begun) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  const total = start.hour * 3600 + start.minute * 60 + seconds;
  const pad = (value: number) => String(value).padStart(2, "0");
  return <time className={styles.clock}>{pad(Math.floor(total / 3600) % 24)}:{pad(Math.floor(total / 60) % 60)}</time>;
}
