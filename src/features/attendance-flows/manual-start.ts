import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { enqueueLeadEffect } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { getDatabase, schema } from "@/shared/db";
import { flowEffectHandlers } from "./handlers";
import { attendanceFlowsEnabled, startAttendanceRun, type EffectHandlers } from "./runtime";

export type ManualFlowStartResult =
  | { started: true; runId: string; waitingForAgent: boolean }
  | { started: false; error: string };

/** Queues whose attendance flow a director can start a lead in (active, with a flow). */
export async function listAttendanceFlowQueues(tenantId: string) {
  return getDatabase().select({ id: schema.leadQueues.id, name: schema.leadQueues.name, flowName: schema.attendanceFlows.name })
    .from(schema.leadQueues)
    .innerJoin(schema.attendanceFlows, and(eq(schema.attendanceFlows.id, schema.leadQueues.attendanceFlowId), eq(schema.attendanceFlows.tenantId, schema.leadQueues.tenantId)))
    .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.status, "active"), eq(schema.attendanceFlows.status, "active")))
    .orderBy(schema.leadQueues.name);
}

/**
 * Puts a lead without broker in a queue and runs that queue's attendance flow
 * from the start (DEC-127), the same way a lead arriving from Meta does. The
 * lead enters marked as "in qualification" so automatic distribution waits for
 * the flow; when the agent does not start, the mark is undone and the flow's
 * own distribution goes ahead.
 */
export async function startLeadInQueueFlow(
  input: { tenantId: string; leadId: string; queueId: string; actorUserId: string },
  handlers?: EffectHandlers,
): Promise<ManualFlowStartResult> {
  if (!(await attendanceFlowsEnabled())) return { started: false, error: "Os fluxos de atendimento estão desligados pelo Super-admin." };
  const db = getDatabase();
  const [queue] = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, branchId: schema.leadQueues.branchId, flowId: schema.leadQueues.attendanceFlowId })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.id, input.queueId), eq(schema.leadQueues.tenantId, input.tenantId), eq(schema.leadQueues.status, "active")))
    .limit(1);
  if (!queue) return { started: false, error: "Fila não encontrada ou inativa." };
  if (!queue.flowId) return { started: false, error: "Esta fila não tem fluxo de atendimento." };
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, status: schema.leads.status, qualificationStatus: schema.leads.qualificationStatus, qualificationState: schema.leads.qualificationState })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
    .limit(1);
  if (!lead) return { started: false, error: "Lead não encontrado." };
  if (lead.corretorId) return { started: false, error: "Remova a atribuição do corretor antes de iniciar o atendimento pela fila." };
  if (lead.status === "lost" || lead.status === "converted") return { started: false, error: "Lead encerrado não pode iniciar um novo atendimento." };
  const [openRun] = await db.select({ id: schema.attendanceRuns.id }).from(schema.attendanceRuns)
    .where(and(eq(schema.attendanceRuns.tenantId, input.tenantId), eq(schema.attendanceRuns.leadId, input.leadId), inArray(schema.attendanceRuns.status, ["running", "waiting"])))
    .limit(1);
  if (openRun) return { started: false, error: "Este lead já está em um fluxo de atendimento." };

  const now = new Date();
  const branchId = queue.branchId ?? lead.branchId;
  // "From the start, as a lead that just arrived": the agent opens a new conversation.
  await db.update(schema.aiConversations).set({
    status: "NEW", automationState: "AI_ACTIVE", memory: null, lastProcessedMessageId: null,
    startedAt: now, lastActivityAt: now, closedAt: null, updatedAt: now,
  }).where(and(eq(schema.aiConversations.tenantId, input.tenantId), eq(schema.aiConversations.leadId, input.leadId)));
  await db.update(schema.leads).set({
    queueId: queue.id, branchId, distributionStatus: "queued", distributionUpdatedAt: now,
    qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", updatedAt: now,
  }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

  const legacyIntake = async () => {
    await enqueueLeadEffect({ tenantId: input.tenantId, leadId: input.leadId, type: "DISTRIBUTE_LEAD", idempotencyKey: `manual-flow:${input.leadId}:${now.getTime()}`, payload: { branchId, leadName: lead.nome } });
    const { startAiQualificationForLead } = await import("@/features/ai-qualification/service");
    await startAiQualificationForLead({ tenantId: input.tenantId, leadId: input.leadId, actorUserId: input.actorUserId }).catch(() => undefined);
  };
  const run = await startAttendanceRun({ tenantId: input.tenantId, leadId: input.leadId, queueId: queue.id, restart: true },
    handlers ?? flowEffectHandlers({ tenantId: input.tenantId, leadId: input.leadId, actorUserId: input.actorUserId, legacyIntake }))
    .catch(() => ({ started: false as const, reason: "failed" as const }));

  const step = run.started ? run.step : null;
  const waitingForAgent = step?.status === "waiting" && step.waitingFor === "agent";
  if (!waitingForAgent) {
    // The agent is not serving the lead: undo the mark so distribution goes ahead.
    await db.update(schema.leads).set({ qualificationStatus: "pending", qualificationState: "NOT_STARTED", updatedAt: new Date() })
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId), eq(schema.leads.qualificationState, "IN_PROGRESS")));
  }
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "lead", entidadeId: input.leadId, acao: `lead.attendance_flow_started:${queue.name}`.slice(0, 200) });
  if (!run.started) {
    // Never leave the lead without attendance: back to the queue's normal intake.
    await legacyIntake();
    return { started: false, error: "O fluxo não pôde iniciar; o lead seguiu o atendimento normal da fila." };
  }
  return { started: true, runId: run.runId, waitingForAgent };
}
