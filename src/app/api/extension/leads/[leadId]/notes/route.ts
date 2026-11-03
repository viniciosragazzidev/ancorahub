import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { getLeadForExtension } from "@/features/browser-extension/lead-context";
import { notaSchema } from "@/features/browser-extension/schemas";
import { getDatabase, schema } from "@/shared/db";

// Nota interna do corretor. A gaveta só escreve; o conteúdo não volta para a extensão.
export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const { session, context } = await requireExtensionAccess(request, "REGISTER_FEEDBACK");
    const input = notaSchema.parse(await request.json());
    const { leadId } = await params;
    const lead = await getLeadForExtension(context, leadId);
    if (!lead) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (lead.version !== input.expectedVersion) return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
    const notaId = randomUUID();
    await getDatabase().transaction(async (tx) => {
      await tx.insert(schema.leadInteractions).values({ id: notaId, leadId, userId: context.userId, tipo: "note", conteudo: input.conteudo, metadata: { source: "extension" } });
      await recordExtensionAudit("extension.note.created", session, { leadId, entityId: notaId }, tx);
    });
    return NextResponse.json({ notaId, version: input.expectedVersion });
  } catch (error) {
    return extensionErrorResponse(error);
  }
}
