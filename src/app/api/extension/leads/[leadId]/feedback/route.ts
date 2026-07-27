import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { getExtensionTenantContext } from "@/features/browser-extension/context";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { feedbackSchema } from "@/features/browser-extension/schemas";
import { changeLeadStatus } from "@/features/leads/change-lead-status";
import { getDatabase, schema } from "@/shared/db";
import { AuthenticationError } from "@/shared/auth/errors";

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await authenticateExtensionRequest(request);
    const input = feedbackSchema.parse(await request.json());
    const { leadId } = await params;
    const context = await getExtensionTenantContext(session.userId, session.tenantId);
    if (!context) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedVersion) return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
    const db = getDatabase();
    const now = new Date();
    let taskId: string | null = null;
    await db.transaction(async (tx) => {
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId, userId: context.userId, tipo: "note", conteudo: `Atendimento registrado pela extensão: ${input.outcome}${input.note ? ` — ${input.note}` : ""}`, metadata: { source: "BROWSER_EXTENSION", outcome: input.outcome } });
      if (input.nextAction) {
        const dueAt = input.nextActionAt ? new Date(input.nextActionAt) : null;
        const [existing] = await tx.select({ id: schema.leadTasks.id }).from(schema.leadTasks).where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.leadId, leadId), eq(schema.leadTasks.title, input.nextAction), isNull(schema.leadTasks.completedAt))).limit(1);
        taskId = existing?.id ?? randomUUID();
        if (existing) await tx.update(schema.leadTasks).set({ dueAt, updatedAt: now }).where(eq(schema.leadTasks.id, existing.id));
        else await tx.insert(schema.leadTasks).values({ id: taskId, tenantId: context.tenantId, leadId, assignedTo: lead.corretorId ?? context.userId, createdBy: context.userId, title: input.nextAction, dueAt, createdAt: now, updatedAt: now });
      }
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: leadId, acao: "extension.feedback.registered" });
    });
    if (input.statusId) await changeLeadStatus({ leadId, newStatus: input.statusId, expectedVersion: input.expectedVersion }, context);
    return NextResponse.json({ success: true, taskId, version: input.statusId ? input.expectedVersion + 1 : input.expectedVersion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_OPERATION" }, { status: error instanceof AuthenticationError ? 401 : 400 });
  }
}
