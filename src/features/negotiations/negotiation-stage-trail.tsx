"use client";

import { LiteNumber, LiteProgress } from "@/components/lite/motion";

import type { NegotiationLevel } from "./negotiation-model";
import type { NegotiationsDashboardData } from "./queries";
import styles from "./negotiations.module.css";

type TrailStage = Extract<NegotiationLevel, "in_conversation" | "advanced" | "closing">;

const STAGES: Array<{ id: TrailStage; label: string }> = [
  { id: "in_conversation", label: "Em conversa" },
  { id: "advanced", label: "Negociação avançada" },
  { id: "closing", label: "Fechamento" },
];

export function NegotiationStageTrail({ counts, activeFilter = "all", onFilter }: {
  counts: NegotiationsDashboardData["counts"];
  activeFilter?: "all" | NegotiationLevel | "customers_waiting";
  onFilter?: (level: TrailStage) => void;
}) {
  const max = Math.max(1, ...STAGES.map(({ id }) => counts[id]));

  return (
    <section className={styles.trailSection} aria-label="Trilha de negociação">
      <ol className={styles.trail}>
        {STAGES.map(({ id, label }) => {
          const count = counts[id];
          const node = (
            <span className={styles.trailNode} data-level={id}>
              <span>{label}</span>
              <LiteNumber value={count} live className={styles.trailCount} />
            </span>
          );
          return (
            <li key={id} className={styles.trailItem}>
              {onFilter ? (
                <button type="button" className={styles.trailButton} aria-pressed={activeFilter === id} onClick={() => onFilter(id)}>
                  {node}
                </button>
              ) : <div className={styles.trailStatic}>{node}</div>}
              <LiteProgress value={(count / max) * 100} label={`${label}: proporção entre níveis`} className={styles.trailProgress} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
