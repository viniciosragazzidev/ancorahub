import { NextResponse } from "next/server";
import { AuthorizationError } from "@/shared/auth/errors";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { listExtensionLeadsAwaitingStart } from "@/features/browser-extension/aguardando-inicio";

// Leads atribuídos ao corretor que ainda não tiveram o atendimento iniciado (ex.: transferência do Pós-venda).
export async function GET(request: Request) {
  try {
    const { session, context } = await requireExtensionAccess(request, "VIEW_LEAD");
    if (context.role !== "broker") throw new AuthorizationError("Somente o corretor pode consultar leads aguardando início.");
    const leads = await listExtensionLeadsAwaitingStart(context);
    await recordExtensionAudit("extension.leads_awaiting_start.listed", session, { metadata: { count: leads.length } });
    return NextResponse.json({ leads }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
