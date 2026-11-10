"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { ArrowDown, ArrowUp, Moon, MoonStar, Sun, Sunset, UserCheck, Zap } from "lucide-react";

import { AnimatedCounter } from "@/components/arc/animated-counter/animated-counter";
import { motionTokens as m } from "@/components/arc/motion-tokens";

import { LIVE_EXAMPLE, ORIGEM_KEYS, applyEvent, sumOrigens, type OrigemKey, averagePerBroker, nextEvent, percentChange, totalLeads, type LiveData, type LiveEvent, type Plantao, type Turno, type TurnoKey } from "./data";
import styles from "../painel.module.css";

const enter: Transition = { duration: m.duration.considered, ease: [...m.ease.enter] };
const ORIGEM_SHORT: Record<OrigemKey, string> = { tatianaForm: "Form", tatianaWhatsapp: "WhatsApp", renanForm: "Form", renanWhatsapp: "WhatsApp" };
const ORIGEM_LABEL: Record<OrigemKey, string> = { tatianaForm: "Tatiana Form", tatianaWhatsapp: "Tatiana WhatsApp", renanForm: "Renan Form", renanWhatsapp: "Renan WhatsApp" };
const sumAll = (origens: Record<OrigemKey, number>) => ORIGEM_KEYS.reduce((sum, key) => sum + origens[key], 0);
const TURNO_ICON: Record<TurnoKey, typeof Sun> = { manha: Sun, tarde: Sunset, noite: Moon, extra: MoonStar };

/** Suposições: o que este exemplo usa e o design system do Diretor Lite não cobre. Aparecem na tela. */
const ASSUMPTIONS = [
  "Números de destaque maiores que a escala de texto (máx. 48px no Diretor): crescem com a altura da tela, até 128px, para ler de longe ou na TV.",
  "Indicador \"Ao vivo\" com ponto pulsando em --success: o kit de movimento só tem o pulso único de atenção.",
  "Comparação com \"ontem neste horário\": a regra exata (mesmo horário, mesma unidade) fica para a implementação.",
  "Aviso de lead novo reaproveita o aviso escuro do corretor (DS Lite 5.10) em pílula, fora do chat.",
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

  // Simulação: um acontecimento a cada intervalo (lead novo ou presença confirmada).
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
        ? { id: step.current, kind: "lead", title: event.origem ? `Lead novo · ${ORIGEM_LABEL[event.origem]}` : "Lead novo", detail: `foi para ${plantao?.name ?? "o plantão"}` }
        : { id: step.current, kind: "presenca", title: `${event.broker} confirmou presença`, detail: plantao?.name ?? "" });
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setNotice(null), 3200);
    };
    const first = setTimeout(tick, Math.min(3500, intervalMs));
    const every = setInterval(tick, intervalMs);
    return () => { clearTimeout(first); clearInterval(every); clearTimeout(noticeTimer); };
  }, [intervalMs]);

  const total = totalLeads(data.turnos);
  const origens = sumOrigens(data.turnos);
  const change = percentChange(total, data.yesterdaySameTime);
  const running = data.plantoes.filter((plantao) => plantao.state === "agora");
  const receiving = running.reduce((sum, plantao) => sum + plantao.recebendo, 0);
  const scheduled = running.reduce((sum, plantao) => sum + plantao.escalados, 0);
  const confirmed = running.reduce((sum, plantao) => sum + plantao.confirmaram, 0);
  const average = averagePerBroker(data.plantoes);
  const leadFlash = flash?.kind === "lead" ? flash.id : null;

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
            <span className={styles.big}><AnimatedCounter value={total} locale="pt-BR" animateOnView /></span>
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
          <FlashRing id={flash?.kind === "presenca" ? flash.id : null} reduce={reduce} />
          <h2 className={styles.cardLabel}>Corretores recebendo agora</h2>
          <div className={styles.bigRow}>
            <span className={styles.big}><AnimatedCounter value={receiving} locale="pt-BR" animateOnView /></span>
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
        <motion.section className={styles.panel} aria-labelledby="turnos-title" {...rise(4)}>
          <header className={styles.panelHeader}>
            <h2 id="turnos-title" className={styles.panelTitle}>Leads por turno</h2>
          </header>
          <div className={`${styles.turnoGrid} ${styles.turnoHead}`} aria-hidden>
            <span style={{ gridColumn: "3 / span 2" }} className={styles.groupLabel}>Tatiana</span>
            <span style={{ gridColumn: "5 / span 2" }} className={styles.groupLabel}>Renan</span>
            <span style={{ gridColumn: "1 / span 2", gridRow: 2 }}>Turno</span>
            {ORIGEM_KEYS.map((key, i) => <span key={key} style={{ gridColumn: 3 + i, gridRow: 2 }} className={styles.alignEnd}>{ORIGEM_SHORT[key]}</span>)}
            <span style={{ gridColumn: 7, gridRow: 2 }} className={styles.alignEnd}>Total</span>
          </div>
          <ul className={styles.turnos}>
            {data.turnos.map((turno, index) => (
              <TurnoRow key={turno.key} turno={turno} max={Math.max(...data.turnos.map((item) => Math.max(item.leads, item.yesterday)))} index={index} reduce={reduce} flash={flash?.turno === turno.key ? flash : null} />
            ))}
          </ul>
          <div className={`${styles.turnoGrid} ${styles.turnoFoot}`}>
            <span className={styles.turnoFootLabel} style={{ gridColumn: "1 / span 2" }}>
              Total do dia
              {total - sumAll(origens) > 0 ? <span className={styles.turnoFootNote}>inclui {total - sumAll(origens)} de outras origens</span> : null}
            </span>
            {ORIGEM_KEYS.map((key) => (
              <span key={key} className={`${styles.origemCell} ${styles.alignEnd}`} aria-label={`${ORIGEM_LABEL[key]}: ${origens[key]}`}>
                <AnimatedCounter value={origens[key]} locale="pt-BR" animateOnView />
              </span>
            ))}
            <span className={`${styles.origemCell} ${styles.origemTotal} ${styles.alignEnd}`}><AnimatedCounter value={total} locale="pt-BR" animateOnView /></span>
          </div>
        </motion.section>

        <motion.section className={styles.panel} aria-labelledby="plantoes-title" {...rise(5)}>
          <header className={styles.panelHeader}>
            <h2 id="plantoes-title" className={styles.panelTitle}>Corretores por plantão</h2>
            <ul className={styles.legend} aria-label="Legenda">
              <li><span className={`${styles.dot} ${styles.dotOn}`} aria-hidden />Recebendo agora</li>
              <li><span className={`${styles.dot} ${styles.dotConfirmed}`} aria-hidden />Confirmou, sem receber</li>
              <li><span className={`${styles.dot} ${styles.dotOff}`} aria-hidden />Não confirmou</li>
            </ul>
          </header>
          <div className={styles.plantaoHead} aria-hidden>
            <span>Plantão</span><span>Corretores</span><span className={styles.alignEnd}>Recebendo</span><span className={styles.alignEnd}>Média</span>
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

function TurnoRow({ turno, max, index, reduce, flash }: { turno: Turno; max: number; index: number; reduce: boolean; flash: Flash | null }) {
  const Icon = TURNO_ICON[turno.key];
  const share = max ? turno.leads / max : 0;
  const yesterdayShare = max ? turno.yesterday / max : 0;
  const later = turno.state === "depois";
  return (
    <li className={`${styles.turnoGrid} ${styles.turno}`} data-state={turno.state}>
      <FlashRing id={flash && !flash.origem ? flash.id : null} reduce={reduce} />
      <span className={styles.turnoIcon} aria-hidden><Icon size={20} strokeWidth={1.75} /></span>
      <div className={styles.turnoMain}>
        <p className={styles.turnoName}>
          {turno.label}
          {turno.state === "agora" ? <span className={styles.nowPill}><span className={styles.liveDotBlue} aria-hidden />Agora</span> : null}
        </p>
        <p className={styles.turnoHours}>
          {later ? `Começa às ${turno.startsAt}` : turno.hours}
          {turno.yesterday ? ` · ontem ${turno.yesterday}` : null}
        </p>
        <div className={styles.track} aria-hidden>
          {yesterdayShare ? <span className={styles.trackYesterday} style={{ width: `${yesterdayShare * 100}%` }} /> : null}
          <motion.span
            className={styles.trackFill}
            initial={{ scaleX: reduce ? share : 0 }}
            animate={{ scaleX: share }}
            transition={reduce ? { duration: 0 } : { ...m.spring.smooth, delay: 0.2 + index * 0.06 }}
          />
        </div>
      </div>
      {ORIGEM_KEYS.map((key) => (
        <span key={key} className={`${styles.origemCell} ${styles.alignEnd}`} data-empty={later ? "" : undefined} aria-label={`${ORIGEM_LABEL[key]}: ${turno.origens[key]}`}>
          <FlashRing id={flash?.origem === key ? flash.id : null} reduce={reduce} />
          {later ? "–" : <AnimatedCounter value={turno.origens[key]} locale="pt-BR" animateOnView />}
        </span>
      ))}
      <span className={`${styles.turnoNumber} ${styles.alignEnd}`} data-empty={later ? "" : undefined}>
        {later ? "–" : <AnimatedCounter value={turno.leads} locale="pt-BR" animateOnView />}
      </span>
    </li>
  );
}

function PlantaoRow({ plantao, index, reduce, flashId }: { plantao: Plantao; index: number; reduce: boolean; flashId: number | null }) {
  const dots = useMemo(() => Array.from({ length: plantao.escalados }, (_, i) => (
    plantao.state !== "agora" ? (i < plantao.confirmaram ? "done" : "off") : i < plantao.recebendo ? "on" : i < plantao.confirmaram ? "confirmed" : "off"
  )), [plantao]);
  const average = plantao.receberam ? Math.round((plantao.leads / plantao.receberam) * 10) / 10 : null;
  const status = plantao.state === "agora" ? null : plantao.state === "encerrado" ? `Encerrado · ${plantao.confirmaram} vieram` : `Começa às ${plantao.hours.slice(0, 5)}`;
  return (
    <li className={styles.plantao} data-state={plantao.state}>
      <FlashRing id={flashId} reduce={reduce} />
      <div className={styles.plantaoName}>
        <p>{plantao.name}</p>
        <p className={styles.plantaoHours}>{status ?? plantao.hours}</p>
      </div>
      <div className={styles.dots} role="img" aria-label={`${plantao.escalados} escalados, ${plantao.confirmaram} confirmaram, ${plantao.recebendo} recebendo agora`}>
        {dots.map((kind, i) => (
          <motion.span
            key={i}
            className={`${styles.dot} ${styles.dotBig} ${kind === "on" ? styles.dotOn : kind === "confirmed" ? styles.dotConfirmed : kind === "done" ? styles.dotDone : styles.dotOff}`}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { ...m.spring.snappy, delay: 0.25 + index * 0.05 + Math.min(i, 15) * m.stagger.char }}
          />
        ))}
      </div>
      <p className={`${styles.plantaoNumber} ${styles.alignEnd}`}>
        {plantao.state === "agora" ? (
          <>
            <AnimatedCounter value={plantao.recebendo} locale="pt-BR" animateOnView />
            <span className={styles.plantaoOf}>/{plantao.escalados}</span>
          </>
        ) : <span className={styles.plantaoMuted}>{plantao.escalados} escalados</span>}
      </p>
      <p className={`${styles.plantaoAverage} ${styles.alignEnd}`}>
        {average !== null ? <AnimatedCounter value={average} decimals={1} locale="pt-BR" animateOnView /> : <span className={styles.plantaoMuted}>–</span>}
      </p>
    </li>
  );
}

/** Destaque de chegada: um anel azul suave que aparece e some uma vez (só opacidade com movimento reduzido). */
function FlashRing({ id, reduce }: { id: number | null; reduce: boolean }) {
  return (
    <AnimatePresence>
      {id !== null ? (
        <motion.span
          key={id}
          className={styles.flash}
          aria-hidden
          initial={{ opacity: m.attention.opacity + 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: reduce ? m.duration.considered : 1.4, ease: [...m.ease.standard] }}
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
          initial={{ opacity: 0, y: reduce ? 0 : m.distance.md }}
          animate={{ opacity: [0, 1, 1, 0], y: reduce ? 0 : -m.distance.lg }}
          transition={{ duration: 1.6, times: [0, 0.15, 0.7, 1], ease: [...m.ease.standard] }}
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
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, transition: { duration: 0.22, ease: [...m.ease.exit] } }}
            transition={reduce ? { duration: m.duration.instant } : { type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
          >
            <span className={styles.noticeIcon} aria-hidden>{notice.kind === "lead" ? <Zap size={14} /> : <UserCheck size={14} />}</span>
            <strong>{notice.title}</strong>
            <span className={styles.noticeDetail}>{notice.detail}</span>
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

