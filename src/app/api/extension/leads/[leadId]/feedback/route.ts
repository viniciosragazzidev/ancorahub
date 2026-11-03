import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { extensionAuditMetadata, recordExtensionAudit } from "@/features/browser-extension/audit";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { feedbackSchema } from "@/features/browser-extension/schemas";
import { changeLeadStatus } from "@/features/leads/change-lead-status";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "@/shared/auth/errors";

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "REGISTER_FEEDBACK");
    const input = feedbackSchema.parse(await request.json());
    const { leadId } = await params;
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedVersion) return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
    if (input.statusId && !session.permissions.includes("CHANGE_STATUS")) throw new AuthorizationError("Permissão insuficiente.");
    if (input.nextAction && !session.permissions.includes("CREATE_TASK")) throw new AuthorizationError("Permissão insuficiente.");
    // Status primeiro: se o serviço recusar (transição, motivo de perda ou versão), nem nota nem tarefa são gravadas.
    if (input.statusId) {
      await changeLeadStatus({ leadId, newStatus: input.statusId, expectedVersion: input.expectedVersion, motivoPerda: input.motivoPerda }, context, undefined, { action: "extension.status.changed", metadata: extensionAuditMetadata(session) });
    }
    const db = getDatabase();
    const now = new Date();
    let taskId: string | null = null;
    await db.transaction(async (tx) => {
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId, userId: context.userId, tipo: "note", conteudo: `Atendimento registrado pela extensão: ${input.outcome}${input.note ? ` — ${input.note}` : ""}`, metadata: { source: "BROWSER_EXTENSION", outcome: input.outcome } });
      if (input.nextAction) {
        const dueAt = input.nextActionAt ? new Date(input.nextActionAt) : null;
        const [existing] = await tx.select({ id: schema.leadTasks.id }).from(schema.leadTasks).where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.leadId, leadId), eq(schema.leadTasks.title, input.nextAction), isNull(schema.leadTasks.completedAt))).limit(1);
        taskId = existing?.id ?? randomUUID();
        if (existing) await tx.update(schema.leadTasks).set({ dueAt, updatedAt: now }).where(and(eq(schema.leadTasks.id, existing.id), eq(schema.leadTasks.tenantId, context.tenantId)));
        else await tx.insert(schema.leadTasks).values({ id: taskId, tenantId: context.tenantId, leadId, assignedTo: lead.corretorId ?? context.userId, createdBy: context.userId, title: input.nextAction, dueAt, createdAt: now, updatedAt: now });
      }
      await recordExtensionAudit("extension.feedback.registered", session, { leadId }, tx);
    });
    return NextResponse.json({ success: true, taskId, version: input.statusId ? input.expectedVersion + 1 : input.expectedVersion });
  } catch (error) {
    // Versão mudou entre a checagem e a gravação do status: conflito, a gaveta recarrega (igual à rota de status).
    if (error instanceof Error && error.message === "CONFLICT_VERSION") return NextResponse.json({ error: "CONFLICT", message: "Este lead foi atualizado em outro local." }, { status: 409 });
    return extensionErrorResponse(error);
  }
}
