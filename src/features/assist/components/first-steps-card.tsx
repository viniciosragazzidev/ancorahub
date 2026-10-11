"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotionConfig } from "motion/react";

import { TOUR_STORAGE_KEY } from "@/components/chat/tour/tour-steps";
import { readSeen, writeSeen } from "@/components/chat/tour/seen-storage";

import type { FirstStep } from "../first-steps";
import styles from "./first-steps.module.css";

const HIDE_KEY = "ancora:first-steps:hidden";

/**
 * "Primeiros passos" of a new broker on the Início: what is left to set up,
 * with a ring of progress. The tour step is read on this device. "Depois"
 * hides it for this device; it disappears for good when everything is done.
 */
export function FirstStepsCard({ steps, className }: { steps: FirstStep[]; className?: string }) {
  const reduce = useReducedMotionConfig();
  const [list, setList] = useState(steps);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let tourDone = false;
    let wasHidden = false;
    try {
      tourDone = readSeen(TOUR_STORAGE_KEY) === "done";
      wasHidden = readSeen(HIDE_KEY) === "1";
    } catch { /* private mode */ }
    setList(steps.map((step) => (step.key === "tour" ? { ...step, done: tourDone } : step)));
    setHidden(wasHidden);
  }, [steps]);

  const total = list.length;
  const done = list.filter((step) => step.done).length;
  if (hidden || done === total) return null;
  const next = list.find((step) => !step.done);
  const radius = 16;
  const length = 2 * Math.PI * radius;

  return (
    <motion.section className={`${styles.card} ${className ?? ""}`} aria-labelledby="first-steps-title" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className={styles.head}>
        <span className={styles.ring} role="img" aria-label={`${done} de ${total} passos feitos`}>
          <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
            <circle cx="20" cy="20" r={radius} className={styles.track} />
            <circle cx="20" cy="20" r={radius} className={styles.value} strokeDasharray={length} strokeDashoffset={length * (1 - done / total)} transform="rotate(-90 20 20)" />
          </svg>
          <span>{done}/{total}</span>
        </span>
        <div className={styles.headText}>
          <h2 id="first-steps-title">Primeiros passos</h2>
          <p>{next ? <>Agora: <strong>{next.title.toLowerCase()}</strong></> : "Tudo pronto."}</p>
        </div>
        <button type="button" className={styles.later} onClick={() => { setHidden(true); writeSeen(HIDE_KEY, "1"); }}>Depois</button>
      </div>
      <ol className={styles.steps}>
        {list.map((step) => (
          <li key={step.key} data-done={step.done}>
            {step.done ? (
              <span className={styles.step} aria-label={`${step.title}: feito`}>
                <span className={styles.check} aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg></span>
                <span className={styles.stepText}><strong>{step.title}</strong></span>
              </span>
            ) : (
              <Link href={step.href} className={styles.step}>
                <span className={styles.check} aria-hidden="true" />
                <span className={styles.stepText}><strong>{step.title}</strong><small>{step.detail}</small></span>
                <svg className={styles.go} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
