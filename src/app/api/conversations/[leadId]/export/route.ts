import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { canExportConversation, getConversationExportData } from "@/features/conversations/conversation-export";
import { encodeConversationExportPdf } from "@/features/conversations/conversation-export-pdf";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

function fileSlug(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "lead";
}

/** The conversation of one lead as a PDF: messages, the lead's information and its broker. */
export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const context = await getRequiredTenantContext();
    if (!canExportConversation(context.role)) {
      return NextResponse.json({ error: "Sem permissão para exportar conversas." }, { status: 403 });
    }
    const { leadId } = await params;
    if (!leadId || leadId.length > 64) return NextResponse.json({ error: "Lead inválido." }, { status: 400 });

    const data = await getConversationExportData(context, leadId);
    // Out of scope looks the same as missing: the route never confirms a lead it does not show.
    if (!data) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });

    const body = await encodeConversationExportPdf(data);
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: leadId,
      acao: `conversation.exported:pdf:${data.messages.length}`,
    });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(body.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="conversa-${fileSlug(data.leadName)}-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[conversation-export] failed", { error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) });
    return NextResponse.json({ error: "Não foi possível gerar o arquivo da conversa." }, { status: 500 });
  }
}
