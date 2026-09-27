/**
 * Attendance flow runtime on the real schema, inside transactions that are
 * ROLLED BACK. Leads are created inside the transaction; the AI agent and the
 * intake are stubs, so nothing is sent. Opt-in only:
 *   RUN_FLOWS_DB_E2E=1 npx vitest run src/features/attendance-flows/runtime.db.test.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));

const enabled = process.env.RUN_FLOWS_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });
class Rollback extends Error {}
type Tx = NonNullable<typeof db>;

async function inRollback(run: (tx: Tx, ctx: { tenantId: string; queueId: string; branchId: string }) => Promise<void>) {
  await db!.transaction(async (tx) => {
    state.tx = tx;
    const s = realSchema;
    const [queue] = await tx.select({ id: s.leadQueues.id, tenantId: s.leadQueues.tenantId, branchId: s.leadQueues.branchId }).from(s.leadQueues).where(eq(s.leadQueues.status, "active")).limit(1);
    await tx.insert(s.systemSettings).values({ key: "feature_attendance_flows_enabled", value: "true" }).onConflictDoUpdate({ target: s.systemSettings.key, set: { value: "true" } });
    await run(tx as unknown as Tx, { tenantId: queue.tenantId, queueId: queue.id, branchId: queue.branchId ?? "" });
    throw new Rollback();
  }).catch((error) => { if (!(error instanceof Rollback)) throw error; });
}

async function newLead(tx: Tx, tenantId: string, queueId: string, branchId: string) {
  const id = randomUUID();
  await tx.insert(realSchema.leads).values({ id, tenantId, queueId, branchId: branchId || null, nome: "Lead de teste do fluxo", telefone: `55219${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}` } as typeof realSchema.leads.$inferInsert);
  return id;
}

function stubs(overrides: Partial<{ agentStarted: boolean }> = {}) {
  const calls = { legacy: 0, distribute: [] as string[], agent: 0 };
  return {
    calls,
    handlers: (real: { distribute: (input: { tenantId: string; leadId: string; runId: string; nodeId: string }) => Promise<void> }) => ({
      legacyIntake: async () => { calls.legacy += 1; },
      distribute: async (input: { tenantId: string; leadId: string; runId: string; nodeId: string }) => { calls.distribute.push(input.nodeId); await real.distribute(input); },
      startAgent: async () => { calls.agent += 1; return { started: overrides.agentStarted ?? false }; },
    }),
  };
}

describe.skipIf(!enabled)("attendance flow runtime (real schema, rolled back)", () => {
  it("runs the ready-made flows, one run per lead, and wakes agent waits", async () => {
    await inRollback(async (tx, { tenantId, queueId, branchId }) => {
      const s = realSchema;
      const runtime = await import("./runtime");
      const { flowEffectHandlers } = await import("./handlers");
      const flows = await runtime.ensureBuiltinFlows(tenantId);
      expect([...flows.keys()].sort()).toEqual(["current", "distribute_now", "qualify_new_engine"]);
      // Idempotent: a second call creates nothing new.
      await runtime.ensureBuiltinFlows(tenantId);
      expect((await tx.select({ id: s.attendanceFlows.id }).from(s.attendanceFlows).where(eq(s.attendanceFlows.tenantId, tenantId))).length).toBe(3);
      const real = flowEffectHandlers({ tenantId, leadId: "", actorUserId: "", legacyIntake: async () => undefined });
      const setQueueFlow = (key: string) => tx.update(s.leadQueues).set({ attendanceFlowId: flows.get(key)! }).where(eq(s.leadQueues.id, queueId));

      // A queue without a flow keeps today's intake.
      const plainLead = await newLead(tx, tenantId, queueId, branchId);
      expect(await runtime.startAttendanceRun({ tenantId, leadId: plainLead, queueId }, stubs().handlers(real))).toMatchObject({ started: false, reason: "no_flow" });

      // "Atendimento atual": exactly today's intake, once.
      await setQueueFlow("current");
      const currentLead = await newLead(tx, tenantId, queueId, branchId);
      const current = stubs();
      expect(await runtime.startAttendanceRun({ tenantId, leadId: currentLead, queueId }, current.handlers(real))).toMatchObject({ started: true, step: { status: "completed" } });
      expect(current.calls).toEqual({ legacy: 1, distribute: [], agent: 0 });
      // One run per lead: a second start does not run the intake again.
      expect(await runtime.startAttendanceRun({ tenantId, leadId: currentLead, queueId }, current.handlers(real))).toMatchObject({ started: false, reason: "already_running" });
      expect(current.calls.legacy).toBe(1);

      // "Direto para a distribuição": one distribution effect, recorded as a step.
      await setQueueFlow("distribute_now");
      const directLead = await newLead(tx, tenantId, queueId, branchId);
      const direct = stubs();
      const directRun = await runtime.startAttendanceRun({ tenantId, leadId: directLead, queueId }, direct.handlers(real));
      expect(directRun).toMatchObject({ started: true, step: { status: "completed" } });
      expect(direct.calls.distribute).toEqual(["transfer"]);
      const effects = await tx.select({ key: s.leadEffectOutbox.idempotencyKey }).from(s.leadEffectOutbox).where(and(eq(s.leadEffectOutbox.leadId, directLead), eq(s.leadEffectOutbox.type, "DISTRIBUTE_LEAD")));
      expect(effects.map((row) => row.key)).toEqual([`attendance:${(directRun as { runId: string }).runId}:transfer`]);

      // New engine for a lead outside the test group: the agent does not start, the flow distributes.
      await setQueueFlow("qualify_new_engine");
      const outsider = await newLead(tx, tenantId, queueId, branchId);
      const notStarted = stubs({ agentStarted: false });
      expect(await runtime.startAttendanceRun({ tenantId, leadId: outsider, queueId }, notStarted.handlers(real))).toMatchObject({ started: true, step: { status: "completed" } });
      expect(notStarted.calls).toMatchObject({ agent: 1, distribute: ["transfer"] });

      // Agent started: the run waits; once the lead is distributed it concludes without distributing again.
      const served = await newLead(tx, tenantId, queueId, branchId);
      const agent = stubs({ agentStarted: true });
      const waiting = await runtime.startAttendanceRun({ tenantId, leadId: served, queueId }, agent.handlers(real));
      expect(waiting).toMatchObject({ started: true, step: { status: "waiting", waitingFor: "agent" } });
      const runId = (waiting as { runId: string }).runId;
      const [row] = await tx.select({ startedAt: s.attendanceRuns.startedAt }).from(s.attendanceRuns).where(eq(s.attendanceRuns.id, runId));
      const [actor] = await tx.select({ userId: s.tenantMemberships.userId }).from(s.tenantMemberships).where(eq(s.tenantMemberships.tenantId, tenantId)).limit(1);
      await tx.insert(s.leadDistributionEvents).values({ id: randomUUID(), tenantId, leadId: served, action: "distributed", source: "human_handoff", strategy: "test", reason: "agent concluded (test)", actorId: actor.userId, createdAt: new Date(row.startedAt.getTime() + 60_000) } as typeof s.leadDistributionEvents.$inferInsert);
      await runtime.wakeDueRuns(() => agent.handlers(real), 50, new Date(row.startedAt.getTime() + 3 * 60_000));
      const [concluded] = await tx.select({ status: s.attendanceRuns.status }).from(s.attendanceRuns).where(eq(s.attendanceRuns.id, runId));
      expect(concluded.status).toBe("completed");
      expect(agent.calls.distribute).toEqual([]);

      // Agent started but never concluded: after the limit the flow distributes.
      const stuck = await newLead(tx, tenantId, queueId, branchId);
      const stuckStubs = stubs({ agentStarted: true });
      const stuckRun = await runtime.startAttendanceRun({ tenantId, leadId: stuck, queueId }, stuckStubs.handlers(real));
      const [stuckRow] = await tx.select({ startedAt: s.attendanceRuns.startedAt }).from(s.attendanceRuns).where(eq(s.attendanceRuns.id, (stuckRun as { runId: string }).runId));
      // Before the limit it only re-checks later.
      await runtime.wakeDueRuns(() => stuckStubs.handlers(real), 50, new Date(stuckRow.startedAt.getTime() + 3 * 60_000));
      expect(stuckStubs.calls.distribute).toEqual([]);
      await tx.update(s.attendanceRuns).set({ wakeAt: new Date(0) }).where(eq(s.attendanceRuns.id, (stuckRun as { runId: string }).runId));
      await runtime.wakeDueRuns(() => stuckStubs.handlers(real), 50, new Date(stuckRow.startedAt.getTime() + runtime.AGENT_WAIT_LIMIT_MS + 60_000));
      expect(stuckStubs.calls.distribute).toEqual(["transfer"]);

      // Switch off: nothing runs through flows.
      await tx.update(s.systemSettings).set({ value: "false" }).where(eq(s.systemSettings.key, "feature_attendance_flows_enabled"));
      const offLead = await newLead(tx, tenantId, queueId, branchId);
      expect(await runtime.startAttendanceRun({ tenantId, leadId: offLead, queueId }, stubs().handlers(real))).toMatchObject({ started: false, reason: "not_enabled" });
    });
  }, 180_000);
});
