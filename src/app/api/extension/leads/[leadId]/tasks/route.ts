import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { tarefaSchema } from "@/features/browser-extension/schemas";
import { criarTarefaDoLead } from "@/features/leads/tarefa-servico";

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "CREATE_TASK");
    const input = tarefaSchema.parse(await request.json());
    const { leadId } = await params;
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedVersion) return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
    // Mesmo serviço da tela do CRM: as regras de responsável e de escopo são as dele.
    const { taskId } = await criarTarefaDoLead(context, { leadId, title: input.title, dueAt: input.dueAt, priority: "normal", assigneeIds: [] });
    await recordExtensionAudit("extension.task.created", session, { leadId, entityId: taskId });
    return NextResponse.json({ taskId, version: input.expectedVersion });
  } catch (error) {
    return extensionErrorResponse(error);
  }
}
