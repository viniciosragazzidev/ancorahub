import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { motionTokens } from "@/components/arc/motion-tokens";
import { cn } from "@/lib/utils";

import type { ArrivalView, NextStep } from "./lead-arrival";

/**
 * Top of the lead screen: who, the status, and when the lead arrived. The arrival is always visible
 * and stands out when it is not today (Vinicios, 17/10: a lead from days ago must not look like today's).
 */
export function LeadHeaderBar({ name, statusLabel, statusTone = "neutral", arrival, subline }: {
  name: string;
  statusLabel: string;
  statusTone?: BadgeTone;
  arrival: ArrivalView | null;
  subline?: ReactNode;
}) {
  return (
    <header className="arc-venancor flex min-w-0 items-center gap-3" aria-label="Lead">
      <Avatar name={name} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="truncate text-lg font-bold tracking-tight text-(--foreground)">{name}</h1>
        {subline ? <p className="truncate text-sm text-(--text-secondary)">{subline}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {arrival ? <Badge tone={arrival.stale ? "warning" : "info"}>{arrival.text}</Badge> : null}
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
      </div>
    </header>
  );
}

const stepTone: Record<NextStep["tone"], string> = {
  urgent: "bg-(--accent-subtle)",
  normal: "bg-(--surface-muted)",
  done: "bg-(--surface-muted)",
};

/**
 * The one next step, with its single button (when there is one). The title says what to do, the detail says
 * what is happening now ("Cliente respondeu há 5 min").
 */
export function NextStepCard({ step, action }: { step: NextStep; action?: ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  // Keyed by the step: when the next step changes, the card moves into its new state (transform only).
  return (
    <motion.section
      key={step.kind + step.title}
      aria-label="Próximo passo"
      initial={reduce ? false : { y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}
      className={cn("arc-venancor flex flex-col gap-3 rounded-3xl p-4 shadow-(--shadow-resting)", stepTone[step.tone])}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-(--foreground)">{step.title}</h2>
        <p className="text-sm text-(--text-secondary)">{step.detail}</p>
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </motion.section>
  );
}
