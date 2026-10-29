"use client";

import { useReducedMotion } from "motion/react";

import type { DutyQueueOrderPreview } from "@/features/lead-distribution/duty-queue-order-queries";
import { TurnStrip } from "./duty-queue-order-board";

/** Anterior, recebendo agora and próximo of one plantão, above its broker cards (29/10). */
export function DutyTurnStrip(props: { scheduleName: string; previous: DutyQueueOrderPreview["previous"]; current: DutyQueueOrderPreview["current"]; nextId: string | null; nextName: string | null }) {
  const reduceMotion = useReducedMotion() ?? false;
  return <TurnStrip preview={{ scheduleName: props.scheduleName, previous: props.previous, current: props.current }} nextId={props.nextId} nextName={props.nextName} reduceMotion={reduceMotion} />;
}
