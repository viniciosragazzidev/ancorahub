import { NextResponse } from "next/server";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { getExtensionTenantContext } from "@/features/browser-extension/context";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { suggestionSchema } from "@/features/browser-extension/schemas";
import { AuthenticationError } from "@/shared/auth/errors";

const fieldLabel: Record<string, string> = { numberOfLives: "quantas pessoas serão incluídas", city: "em qual cidade você mora", age: "qual é a idade das pessoas", currentPlan: "qual plano você possui hoje", budget: "qual faixa de investimento você considera" };

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await authenticateExtensionRequest(request);
    const input = suggestionSchema.parse(await request.json());
    const { leadId } = await params;
    const context = await getExtensionTenantContext(session.userId, session.tenantId);
    if (!context) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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
    return NextResponse.json({ suggestions: suggestions.slice(0, 3), source: "CRM_CONTEXT", aiUsed: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_REQUEST" }, { status: error instanceof AuthenticationError ? 401 : 400 });
  }
}
