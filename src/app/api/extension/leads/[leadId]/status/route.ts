import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { extensionAuditMetadata } from "@/features/browser-extension/audit";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { statusPatchSchema } from "@/features/browser-extension/schemas";
import { changeLeadStatus } from "@/features/leads/change-lead-status";

export async function PATCH(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "CHANGE_STATUS");
    const input = statusPatchSchema.parse(await request.json());
    const { leadId } = await params;
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedVersion) return NextResponse.json({ error: "CONFLICT", message: "Este lead foi atualizado em outro local." }, { status: 409 });
    // Transições válidas e motivo de perda são validados pelo serviço (o mesmo da tela do CRM).
    const result = await changeLeadStatus({ leadId, newStatus: input.statusId, expectedVersion: input.expectedVersion, motivoPerda: input.motivoPerda }, context, undefined, { action: "extension.status.changed", metadata: extensionAuditMetadata(session) });
    return NextResponse.json({ ...result, version: input.expectedVersion + 1 });
  } catch (error) {
    // Versão mudou entre a checagem e a gravação: conflito, a gaveta recarrega.
    if (error instanceof Error && error.message === "CONFLICT_VERSION") return NextResponse.json({ error: "CONFLICT", message: "Este lead foi atualizado em outro local." }, { status: 409 });
    return extensionErrorResponse(error);
  }
}
