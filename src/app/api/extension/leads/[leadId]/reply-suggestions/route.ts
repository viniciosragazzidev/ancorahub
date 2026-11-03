import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { suggestionSchema } from "@/features/browser-extension/schemas";
import { contextoDaSugestao, sugestoesDoRoteiro } from "@/features/browser-extension/sugestoes";

// Sugestões deterministas do roteiro (sem IA). A extensão só preenche o compositor; nunca envia.
export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "GENERATE_REPLY");
    const input = suggestionSchema.parse(await request.json());
    const { leadId } = await params;
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedLeadVersion) return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
    const contexto = await contextoDaSugestao(context, leadId);
    if (!contexto) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    await recordExtensionAudit("extension.reply.suggested", session, { leadId });
    return NextResponse.json({ suggestions: sugestoesDoRoteiro(input.goal, contexto).slice(0, 3), source: "CRM_ROTEIRO", aiUsed: false });
  } catch (error) {
    return extensionErrorResponse(error);
  }
}
