import { NextResponse } from "next/server";
import { AuthorizationError } from "@/shared/auth/errors";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { loadExtensionQualificationThread } from "@/features/browser-extension/qualification-thread";

// Histórico da qualificação dentro da conversa do lead. Só leitura: nada é gravado nem enviado.
export async function GET(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "VIEW_LEAD");
    if (context.role !== "broker") throw new AuthorizationError("Somente o corretor pode ver a conversa da qualificação.");
    const { leadId } = await params;
    const thread = await loadExtensionQualificationThread(context, leadId);
    if (!thread) return NextResponse.json({ error: "NOT_FOUND", message: "Este lead não está mais disponível para você." }, { status: 404 });
    await recordExtensionAudit("extension.qualification_thread.viewed", session, { leadId, metadata: { count: thread.mensagens.length, total: thread.total } });
    return NextResponse.json(thread, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
