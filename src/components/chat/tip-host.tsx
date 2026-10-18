"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./chat.module.css";

type Tip = {
  id: string; leadId: string; title: string; text: string; cta: { label: string; href: string }; tone: "urgent" | "normal";
  live?: { at: string; othersWaiting: number; quote?: string | null; stage?: string | null; insight?: string | null };
};

const FIRST_CHECK_MS = 25_000;
const CHECK_EVERY_MS = 8 * 60_000;
/** Never more than one tip in this window: a hint, not a flood. */
const COOLDOWN_MS = 20 * 60_000;
/** A little longer since 18/10: the tip now carries the client's message to read. */
const VISIBLE_MS = 20_000;
const STORE = "ancora:tips:v1";

type Memory = { lastShownAt: number; seen: string[]; streakDay: string; streak: number };

function readMemory(): Memory {
  try {
    const raw = window.localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as Partial<Memory>) : {};
    return { lastShownAt: parsed.lastShownAt ?? 0, seen: Array.isArray(parsed.seen) ? parsed.seen.slice(-60) : [], streakDay: parsed.streakDay ?? "", streak: parsed.streak ?? 0 };
  } catch {
    return { lastShownAt: Date.now(), seen: [], streakDay: "", streak: 0 };
  }
}

function writeMemory(memory: Memory) {
  try { window.localStorage.setItem(STORE, JSON.stringify(memory)); } catch { /* storage blocked: tips still work this session */ }
}

const today = () => new Date().toLocaleDateString("en-CA");

function ago(at: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `há ${hours}h` : `há ${Math.floor(hours / 24)}d`;
}

/** The time since it started, counted live while the tip is on screen. */
function LiveAgo({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return <time dateTime={at} className={styles.tipAgo}>{ago(at, now)}</time>;
}

/**
 * The Insights assistant pops up now and then with one quick tip ("Maria está
 * esperando você · Responder"), one tap to act. At most one every 20 minutes,
 * never the same tip twice, never on the lead it talks about, only while the app
 * is on screen. Following tips builds a small streak of the day.
 * It shows what is happening now (18/10): the client's last message, the time
 * counting live, the stage of the conversation and one hint from the AI reading.
 */
export function TipHost() {
  const reduce = useReducedMotion();
  const pathname = usePathname() ?? "";
  const pathRef = useRef(pathname);
  const [tip, setTip] = useState<Tip | null>(null);
  const [streak, setStreak] = useState(0);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const memory = readMemory();
      if (Date.now() - memory.lastShownAt < COOLDOWN_MS) return;
      void fetch("/api/chat/tip", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<{ tip: Tip | null }>) : null))
        .then((body) => {
          const next = body?.tip;
          if (!alive || !next || memory.seen.includes(next.id)) return;
          // Already on that lead: the tip would only interrupt.
          if (pathRef.current.startsWith(`/leads/${next.leadId}`)) return;
          writeMemory({ ...memory, lastShownAt: Date.now(), seen: [...memory.seen, next.id] });
          setStreak(memory.streakDay === today() ? memory.streak : 0);
          setTip(next);
        })
        .catch(() => undefined);
    };
    const first = window.setTimeout(check, FIRST_CHECK_MS);
    const every = window.setInterval(check, CHECK_EVERY_MS);
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(every); };
  }, []);

  // Leaves by itself after a while (the bar at the bottom shows the time left).
  useEffect(() => {
    if (!tip) return;
    const timer = window.setTimeout(() => setTip(null), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [tip]);

  function follow() {
    const memory = readMemory();
    const count = memory.streakDay === today() ? memory.streak + 1 : 1;
    writeMemory({ ...memory, streakDay: today(), streak: count });
    setTip(null);
  }

  // The tip lives outside the chat screens: it brings the Lite tokens (surface, action color) with it.
  return (
    <div className="arc-venancor">
    <AnimatePresence>
      {tip ? (
        <motion.aside
          key={tip.id}
          className={`${styles.root} ${styles.tip}`}
          data-tone={tip.tone}
          role="status"
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.18 } }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        >
          <motion.span
            className={styles.tipMascot}
            initial={reduce ? false : { rotate: -18, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", visualDuration: 0.5, bounce: 0.5, delay: 0.08 }}
            aria-hidden="true"
          >
            <AssistantAvatar shape="salte" hue={200} size={36} state="waiting" />
          </motion.span>
          <span className={styles.tipBody}>
            <span className={styles.tipLabel}>
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6Z" fill="currentColor" /></svg>
              {tip.live?.stage ?? "Dica rápida"}{streak > 0 ? ` · ${streak} ${streak === 1 ? "seguida" : "seguidas"} hoje` : ""}
              {tip.live ? <LiveAgo at={tip.live.at} /> : null}
            </span>
            <span className={styles.tipTitle}>{tip.title}</span>
            {tip.live?.quote ? <span className={styles.tipQuote}><span>{`“${tip.live.quote}”`}</span></span> : null}
            <span className={styles.tipText}>{tip.text}</span>
            {tip.live?.insight ? <span className={styles.tipInsight}>{tip.live.insight}</span> : null}
            {tip.live?.othersWaiting ? <span className={styles.tipOthers}>+{tip.live.othersWaiting} {tip.live.othersWaiting === 1 ? "cliente esperando" : "clientes esperando"} resposta</span> : null}
            <span className={styles.tipActions}>
              <Link href={tip.cta.href} className={styles.tipCta} onClick={follow}>{tip.cta.label}</Link>
              <button type="button" className={styles.tipLater} onClick={() => setTip(null)}>Agora não</button>
            </span>
          </span>
          {reduce ? null : <motion.span className={styles.tipTimer} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: VISIBLE_MS / 1000, ease: "linear" }} aria-hidden="true" />}
        </motion.aside>
      ) : null}
    </AnimatePresence>
    </div>
  );
}
