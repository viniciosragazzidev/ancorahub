import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { suggestionSchema } from "@/features/browser-extension/schemas";

const fieldLabel: Record<string, string> = { numberOfLives: "quantas pessoas serão incluídas", city: "em qual cidade você mora", age: "qual é a idade das pessoas", currentPlan: "qual plano você possui hoje", budget: "qual faixa de investimento você considera" };

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "GENERATE_REPLY");
    const input = suggestionSchema.parse(await request.json());
    const { leadId } = await params;
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedLeadVersion) return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
    const question = fieldLabel.numberOfLives;
    const name = "cliente";
    const suggestions = input.goal === "ASK_MISSING_FIELD" || input.goal === "REQUEST_DATA" ? [
      { id: `${lead.id}-s1`, tone: "DIRECT", text: `Perfeito, ${name}. ${question}?`, basedOn: { missingField: "numberOfLives" } },
      { id: `${lead.id}-s2`, tone: "CONSULTATIVE", text: `Para eu encontrar as melhores opções para você, pode me dizer ${question}?`, basedOn: { missingField: "numberOfLives" } },
    ] : [
      { id: `${lead.id}-s1`, tone: "DIRECT", text: "Entendi. Vou verificar as melhores opções e já retorno com o próximo passo." },
      { id: `${lead.id}-s2`, tone: "CONSULTATIVE", text: "Perfeito, obrigado pelas informações. Vou organizar seu atendimento e retorno em seguida." },
    ];
    await recordExtensionAudit("extension.reply.suggested", session, { leadId });
    return NextResponse.json({ suggestions: suggestions.slice(0, 3), source: "CRM_CONTEXT", aiUsed: false });
  } catch (error) {
    return extensionErrorResponse(error);
  }
}
