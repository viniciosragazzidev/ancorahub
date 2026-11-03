import { NextResponse } from "next/server";
import { AuthorizationError } from "@/shared/auth/errors";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { startExtensionLead } from "@/features/browser-extension/aguardando-inicio";

// "Iniciar e abrir": o mesmo início do botão do CRM. Não envia mensagem; a extensão abre a conversa com a saudação pronta.
export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "ACCEPT_LEAD");
    if (context.role !== "broker") throw new AuthorizationError("Somente o corretor pode iniciar o atendimento.");
    const { leadId } = await params;
    const result = await startExtensionLead(context, leadId);
    if (result.body.success === true) {
      await recordExtensionAudit("extension.lead.service_started", session, { leadId });
    }
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
