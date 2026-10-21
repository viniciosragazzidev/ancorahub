import { saoPauloHour } from "./approaches";
import type { TurboTouch } from "./templates-pack";

/**
 * Reminder cadence after the first contact (plan §5, pilar B).
 * T1 utility 20 min later; T2 marketing 3h later in business hours; T3 the
 * next morning; T4 the farewell three days later. It stops at the first sign
 * from the lead and never sends marketing at night.
 */
export type CadenceStep = {
  touch: Exclude<TurboTouch, "t0" | "reactivation">;
  template: string;
  /** Minimum time after the first contact. */
  afterMinutes: number;
  /** Earliest São Paulo hour of the day it may go out. */
  notBeforeHour?: number;
};

export const CADENCE: readonly CadenceStep[] = [
  { touch: "t1", template: "anc_t1_lembrete", afterMinutes: 20 },
  { touch: "t2", template: "anc_t2_beneficio", afterMinutes: 180 },
  { touch: "t3", template: "anc_t3_ligacao", afterMinutes: 18 * 60, notBeforeHour: 10 },
  { touch: "t4", template: "anc_t4_despedida", afterMinutes: 3 * 24 * 60, notBeforeHour: 10 },
];

/** Messages go out between 8h and 20h (São Paulo); T1 also at night only until 22h. */
const BUSINESS_START = 8;
const BUSINESS_END = 20;
const T1_NIGHT_END = 22;
/** A touch is skipped when it is this late (the moment passed; the next touch takes over). */
const STALE_AFTER_MINUTES = 26 * 60;
/** Minimum gap between two touches (a night T1 sent at 8h must not be followed by T2 at 8h02). */
const MIN_GAP_MINUTES = 90;

export type TurboTouchRecord = {
  touch: TurboTouch;
  template: string | null;
  at: string;
  outboundId?: string | null;
  status?: "sent" | "failed" | "skipped";
  errorCode?: string | null;
};

export type TurboState = {
  approach: string;
  variant: string | null;
  firstContactAt: string;
  touches: TurboTouchRecord[];
  stoppedAt?: string;
  stopReason?: string;
  /** Fields the ad form answered before the first question. */
  seededFromForm?: string[];
};

export type CadenceInput = {
  state: TurboState;
  now: Date;
  /** Latest message the lead sent after the first contact. */
  lastInboundAt: Date | null;
  optedOut: boolean;
  humanActive: boolean;
  assignedToBroker: boolean;
  closed: boolean;
  /** Approved templates in the active WABA. */
  approvedTemplates: ReadonlySet<string>;
};

export type CadenceDecision =
  | { action: "stop"; reason: "replied" | "opt_out" | "human" | "assigned" | "closed" | "finished" | "meta_limit" }
  | { action: "wait" }
  | { action: "send"; step: CadenceStep }
  | { action: "skip"; step: CadenceStep; reason: "template_not_approved" | "stale" };

function inWindow(step: CadenceStep, now: Date) {
  const hour = saoPauloHour(now);
  if (step.notBeforeHour !== undefined && hour < step.notBeforeHour) return false;
  const end = step.touch === "t1" ? T1_NIGHT_END : BUSINESS_END;
  return hour >= BUSINESS_START && hour < end;
}

export function decideNextTouch(input: CadenceInput): CadenceDecision {
  const { state, now } = input;
  const firstAt = new Date(state.firstContactAt).getTime();
  if (input.lastInboundAt && input.lastInboundAt.getTime() > firstAt) return { action: "stop", reason: "replied" };
  if (input.optedOut) return { action: "stop", reason: "opt_out" };
  if (input.humanActive) return { action: "stop", reason: "human" };
  if (input.assignedToBroker) return { action: "stop", reason: "assigned" };
  if (input.closed) return { action: "stop", reason: "closed" };

  // Meta's per-person marketing limit (131049): never insist; Meta asks for 24h and repeated tries block delivery.
  const metaLimited = state.touches.filter((touch) => touch.errorCode === "131049").length;
  if (metaLimited >= 2) return { action: "stop", reason: "meta_limit" };
  const lastLimit = [...state.touches].reverse().find((touch) => touch.errorCode === "131049");
  if (lastLimit && now.getTime() - new Date(lastLimit.at).getTime() < 24 * 60 * 60_000) return { action: "wait" };

  // A touch is done once sent, skipped or failed for good; Meta's limit (131049) and a reminder
  // held by the outbox ("held") are retried, at most three times.
  const retryable = (touch: TurboTouchRecord) => touch.status === "failed" && (touch.errorCode === "131049" || touch.errorCode === "held");
  const attemptsOf = (name: string) => state.touches.filter((touch) => touch.touch === name).length;
  const done = new Set(state.touches.filter((touch) => !retryable(touch) || attemptsOf(touch.touch) >= 3).map((touch) => touch.touch));
  const next = CADENCE.find((step) => !done.has(step.touch));
  if (!next) return { action: "stop", reason: "finished" };

  const elapsedMinutes = (now.getTime() - firstAt) / 60_000;
  if (elapsedMinutes < next.afterMinutes) return { action: "wait" };
  if (!input.approvedTemplates.has(next.template)) return { action: "skip", step: next, reason: "template_not_approved" };
  // T1 only makes sense right after the first contact; later ones wait for the window.
  if (next.touch === "t1" && elapsedMinutes > next.afterMinutes + STALE_AFTER_MINUTES) return { action: "skip", step: next, reason: "stale" };
  // Between reminders only: T1 is meant to follow the first contact after 20 min.
  const lastSent = [...state.touches].reverse().find((touch) => touch.status === "sent" && touch.touch !== "t0");
  if (lastSent && now.getTime() - new Date(lastSent.at).getTime() < MIN_GAP_MINUTES * 60_000) return { action: "wait" };
  if (!inWindow(next, now)) return { action: "wait" };
  return { action: "send", step: next };
}
