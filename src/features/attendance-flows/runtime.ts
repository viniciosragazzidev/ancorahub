import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";

import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { isBusinessHours } from "@/features/team-notices/guard";
import { getDatabase, schema } from "@/shared/db";
import { BUILTIN_FLOWS, type BuiltinFlowKey } from "./builtin";
import { validateFlow, type FlowDefinition } from "./definition";
import { stepFlow, type Effect, type RunEvent, type RunFacts, type StepResult } from "./runner";

/** How long a run waits for the AI agent before handing the lead to distribution. */
export const AGENT_WAIT_LIMIT_MS = 90 * 60_000;
/** While waiting for the agent, the run checks every few minutes whether the lead was already distributed. */
export const AGENT_CHECK_INTERVAL_MS = 2 * 60_000;
const MAX_EFFECTS_PER_ADVANCE = 20;

export type EffectHandlers = {
  /** Today's intake for this lead (distribution and, when the queue has AI, the current qualification). */
  legacyIntake: () => Promise<void>;
  distribute: (input: { tenantId: string; leadId: string; runId: string; nodeId: string }) => Promise<void>;
  startAgent: (input: { tenantId: string; leadId: string; engine: string; runId: string }) => Promise<{ started: boolean }>;
};

export async function attendanceFlowsEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.ATTENDANCE_FLOWS)) === "true";
}

/** The tenant's ready-made flows, each with a published version 1 (created once). */
export async function ensureBuiltinFlows(tenantId: string) {
  const db = getDatabase();
  const existing = await db.select({ id: schema.attendanceFlows.id, key: schema.attendanceFlows.builtinKey })
    .from(schema.attendanceFlows).where(eq(schema.attendanceFlows.tenantId, tenantId));
  const byKey = new Map(existing.map((row) => [row.key, row.id]));
  for (const [key, flow] of Object.entries(BUILTIN_FLOWS) as Array<[BuiltinFlowKey, (typeof BUILTIN_FLOWS)[BuiltinFlowKey]]>) {
    if (byKey.has(key)) continue;
    const flowId = randomUUID();
    const versionId = randomUUID();
    const now = new Date();
    await db.insert(schema.attendanceFlows).values({ id: flowId, tenantId, name: flow.name, description: flow.description, builtinKey: key, status: "active", publishedVersionId: versionId, createdAt: now, updatedAt: now }).onConflictDoNothing();
    await db.insert(schema.attendanceFlowVersions).values({ id: versionId, flowId, tenantId, version: 1, status: "published", definition: flow.definition, publishedAt: now, createdAt: now }).onConflictDoNothing();
    byKey.set(key, flowId);
  }
  return byKey;
}

async function loadRunContext(runId: string) {
  const db = getDatabase();
  const [run] = await db.select().from(schema.attendanceRuns).where(eq(schema.attendanceRuns.id, runId)).limit(1);
  if (!run) return null;
  const [version] = await db.select({ definition: schema.attendanceFlowVersions.definition }).from(schema.attendanceFlowVersions).where(eq(schema.attendanceFlowVersions.id, run.flowVersionId)).limit(1);
  return version ? { run, definition: version.definition as FlowDefinition } : null;
}

function factsFor(now: Date, lastReply: string | null): RunFacts {
  return { now, businessHours: isBusinessHours(now), serviceWindowOpen: false, lastReply, leadFields: {} };
}

/** Runs one effect exactly once per run and block (idempotency key per step). */
async function performEffect(run: { id: string; tenantId: string; leadId: string }, effect: Effect, handlers: EffectHandlers): Promise<{ ok: boolean; agentStarted?: boolean; error?: string }> {
  const db = getDatabase();
  const key = `${run.id}:${effect.nodeId}`;
  const [already] = await db.select({ status: schema.attendanceRunSteps.status }).from(schema.attendanceRunSteps).where(eq(schema.attendanceRunSteps.idempotencyKey, key)).limit(1);
  if (already) return { ok: already.status === "done" };
  let result: { ok: boolean; agentStarted?: boolean; error?: string };
  try {
    switch (effect.kind) {
      case "legacy_intake":
        await handlers.legacyIntake();
        result = { ok: true };
        break;
      case "transfer":
        if (effect.target === "queue" && effect.queueId) {
          await db.update(schema.leads).set({ queueId: effect.queueId, updatedAt: new Date() }).where(and(eq(schema.leads.id, run.leadId), eq(schema.leads.tenantId, run.tenantId)));
        }
        await handlers.distribute({ tenantId: run.tenantId, leadId: run.leadId, runId: run.id, nodeId: effect.nodeId });
        result = { ok: true };
        break;
      case "start_agent": {
        const started = await handlers.startAgent({ tenantId: run.tenantId, leadId: run.leadId, engine: effect.engine, runId: run.id });
        result = { ok: true, agentStarted: started.started };
        break;
      }
      case "update_lead":
        if (effect.status) await db.update(schema.leads).set({ status: effect.status as typeof schema.leads.$inferInsert.status, updatedAt: new Date() }).where(and(eq(schema.leads.id, run.leadId), eq(schema.leads.tenantId, run.tenantId)));
        result = { ok: true };
        break;
      case "send":
        // Sending to the lead from a flow arrives with the visual editor (phase 4).
        result = { ok: false, error: "Envio pelo fluxo ainda não disponível." };
        break;
    }
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "Falha inesperada." };
  }
  await db.insert(schema.attendanceRunSteps).values({
    id: randomUUID(), runId: run.id, tenantId: run.tenantId, nodeId: effect.nodeId, kind: effect.kind,
    status: result.ok ? "done" : "failed", idempotencyKey: key, detail: result.error ? { error: result.error } : result.agentStarted === false ? { agentStarted: false } : null,
  }).onConflictDoNothing();
  return result;
}

async function persist(runId: string, step: StepResult) {
  const now = new Date();
  const done = step.status === "completed" || step.status === "failed";
  await getDatabase().update(schema.attendanceRuns).set({
    status: step.status,
    currentNodeId: step.nodeId,
    waitingFor: step.status === "waiting" ? step.waitingFor : null,
    wakeAt: step.status === "waiting" ? (step.waitingFor === "agent" ? new Date(now.getTime() + AGENT_CHECK_INTERVAL_MS) : step.until) : null,
    error: step.status === "failed" ? step.reason : null,
    endedAt: done ? now : null,
    updatedAt: now,
  }).where(eq(schema.attendanceRuns.id, runId));
}

/** Feeds one event to a run and performs effects until it waits, completes or fails. */
export async function advanceRun(runId: string, event: RunEvent, handlers: EffectHandlers) {
  let context = await loadRunContext(runId);
  if (!context) return null;
  const { definition } = context;
  let step = stepFlow(definition, context.run.currentNodeId, event, factsFor(new Date(), event.type === "reply" ? event.text : context.run.lastReply));
  for (let count = 0; count < MAX_EFFECTS_PER_ADVANCE && step.status === "running"; count += 1) {
    await persist(runId, step);
    const outcome = await performEffect(context.run, step.effect, handlers);
    if (!outcome.ok) {
      step = { status: "failed", nodeId: step.nodeId, reason: outcome.error ?? "Falha ao executar o bloco." };
      break;
    }
    const nodeId = step.nodeId;
    step = stepFlow(definition, nodeId, { type: "effect_done" }, factsFor(new Date(), context.run.lastReply));
    // The agent could not start (no channel, lead outside the test group...): its "failed" exit runs now.
    if (outcome.agentStarted === false && step.status === "waiting" && step.waitingFor === "agent") {
      step = stepFlow(definition, nodeId, { type: "agent_result", outcome: "failed" }, factsFor(new Date(), context.run.lastReply));
    }
    context = { ...context, run: { ...context.run, currentNodeId: nodeId } };
  }
  await persist(runId, step);
  return step;
}

/**
 * Starts the attendance of a lead through its queue's flow. Returns
 * started=false when the switch is off, the queue has no flow or the lead
 * already has an open run: the caller then keeps today's intake.
 */
export async function startAttendanceRun(input: { tenantId: string; leadId: string; queueId: string | null; restart?: boolean }, handlers: EffectHandlers) {
  if (!input.queueId || !(await attendanceFlowsEnabled())) return { started: false as const, reason: "not_enabled" as const };
  const db = getDatabase();
  const [queue] = await db.select({ flowId: schema.leadQueues.attendanceFlowId }).from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.id, input.queueId), eq(schema.leadQueues.tenantId, input.tenantId))).limit(1);
  if (!queue?.flowId) return { started: false as const, reason: "no_flow" as const };
  const [flow] = await db.select({ versionId: schema.attendanceFlows.publishedVersionId, status: schema.attendanceFlows.status })
    .from(schema.attendanceFlows).where(and(eq(schema.attendanceFlows.id, queue.flowId), eq(schema.attendanceFlows.tenantId, input.tenantId))).limit(1);
  if (!flow?.versionId || flow.status !== "active") return { started: false as const, reason: "no_flow" as const };
  const [version] = await db.select({ definition: schema.attendanceFlowVersions.definition }).from(schema.attendanceFlowVersions).where(eq(schema.attendanceFlowVersions.id, flow.versionId)).limit(1);
  if (!version || validateFlow(version.definition as FlowDefinition).length) return { started: false as const, reason: "invalid_flow" as const };

  // A lead goes through its queue's flow once; running it again takes an explicit restart.
  if (!input.restart) {
    const [previous] = await db.select({ id: schema.attendanceRuns.id }).from(schema.attendanceRuns)
      .where(and(eq(schema.attendanceRuns.tenantId, input.tenantId), eq(schema.attendanceRuns.leadId, input.leadId))).limit(1);
    if (previous) return { started: false as const, reason: "already_running" as const };
  }
  const runId = randomUUID();
  const [created] = await db.insert(schema.attendanceRuns).values({ id: runId, tenantId: input.tenantId, leadId: input.leadId, flowVersionId: flow.versionId, queueId: input.queueId, status: "running" })
    .onConflictDoNothing().returning({ id: schema.attendanceRuns.id });
  if (!created) return { started: false as const, reason: "already_running" as const };
  const step = await advanceRun(runId, { type: "start" }, handlers);
  return { started: true as const, runId, step };
}

/** Whether the lead was handed to distribution after `since` (the agent concluded). */
async function distributedSince(tenantId: string, leadId: string, since: Date) {
  const [event] = await getDatabase().select({ id: schema.leadDistributionEvents.id }).from(schema.leadDistributionEvents)
    .where(and(eq(schema.leadDistributionEvents.tenantId, tenantId), eq(schema.leadDistributionEvents.leadId, leadId), gt(schema.leadDistributionEvents.createdAt, since)))
    .limit(1);
  return Boolean(event);
}

/**
 * Wakes runs whose wait is over. Timers and reply timeouts follow their exit.
 * A run waiting for the agent concludes when the lead was distributed, takes
 * the "failed" exit after the limit, and otherwise checks again later.
 */
export async function wakeDueRuns(handlers: (run: { tenantId: string; leadId: string }) => EffectHandlers, limit = 20, now = new Date()) {
  const due = await getDatabase().select({ id: schema.attendanceRuns.id, tenantId: schema.attendanceRuns.tenantId, leadId: schema.attendanceRuns.leadId, waitingFor: schema.attendanceRuns.waitingFor, startedAt: schema.attendanceRuns.startedAt, updatedAt: schema.attendanceRuns.updatedAt })
    .from(schema.attendanceRuns)
    .where(and(eq(schema.attendanceRuns.status, "waiting"), lte(schema.attendanceRuns.wakeAt, now)))
    .limit(limit);
  for (const run of due) {
    if (run.waitingFor !== "agent") {
      await advanceRun(run.id, { type: "timeout" }, handlers(run));
      continue;
    }
    if (await distributedSince(run.tenantId, run.leadId, run.startedAt)) {
      await advanceRun(run.id, { type: "agent_result", outcome: "done" }, handlers(run));
    } else if (now.getTime() - run.startedAt.getTime() >= AGENT_WAIT_LIMIT_MS) {
      await advanceRun(run.id, { type: "agent_result", outcome: "failed" }, handlers(run));
    } else {
      await getDatabase().update(schema.attendanceRuns).set({ wakeAt: new Date(now.getTime() + AGENT_CHECK_INTERVAL_MS), updatedAt: now }).where(eq(schema.attendanceRuns.id, run.id));
    }
  }
  return due.length;
}

/** The AI agent of a lead finished: resumes its open run, if any. */
export async function notifyAgentResult(input: { tenantId: string; leadId: string; outcome: "done" | "failed" }, handlers: EffectHandlers) {
  const [run] = await getDatabase().select({ id: schema.attendanceRuns.id }).from(schema.attendanceRuns)
    .where(and(eq(schema.attendanceRuns.tenantId, input.tenantId), eq(schema.attendanceRuns.leadId, input.leadId), eq(schema.attendanceRuns.status, "waiting"), eq(schema.attendanceRuns.waitingFor, "agent")))
    .limit(1);
  return run ? advanceRun(run.id, { type: "agent_result", outcome: input.outcome }, handlers) : null;
}

/** Whether the lead is owned by an open flow run (legacy follow-ups must stay out of it). */
export async function hasOpenAttendanceRun(tenantId: string, leadId: string) {
  const [run] = await getDatabase().select({ id: schema.attendanceRuns.id }).from(schema.attendanceRuns)
    .where(and(eq(schema.attendanceRuns.tenantId, tenantId), eq(schema.attendanceRuns.leadId, leadId), inArray(schema.attendanceRuns.status, ["running", "waiting"]), isNull(schema.attendanceRuns.endedAt)))
    .limit(1);
  return Boolean(run);
}
