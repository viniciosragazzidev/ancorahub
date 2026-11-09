import { NextRequest, NextResponse } from "next/server";

import {
  downloadConversationMediaObject,
  isConversationMediaEnabled,
  resolveConversationMediaForViewer,
} from "@/features/communication-channels/conversation-media";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { safeFileHeaders } from "@/shared/http/safe-file-headers";

/**
 * Authenticated, tenant-scoped media access for official conversations
 * (DEC-098). Binaries never leave the private R2 bucket through a public URL;
 * every read is derived from the server session and audited.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const context = await getRequiredTenantContext();
    if (!(await isConversationMediaEnabled())) {
      return NextResponse.json(
        { error: "O acesso a mídia está temporariamente desativado pela plataforma." },
        { status: 503 },
      );
    }
    const { messageId } = await params;
    if (!messageId || messageId.length > 64 || !/^[a-zA-Z0-9-]+$/.test(messageId)) {
      return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    }

    const media = await resolveConversationMediaForViewer({
      messageId,
      viewer: {
        tenantId: context.tenantId,
        userId: context.userId,
        role: context.role,
        branchId: context.branchId ?? null,
        supervisorTeamScope: context.supervisorTeamScope,
      },
    });
    if (!media) {
      return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
    }

    const file = await downloadConversationMediaObject(media.mediaStorageKey!);

    await recordMediaAccess({
      tenantId: context.tenantId,
      userId: context.userId,
      messageId,
    });

    // The MIME type was declared by whoever sent the file on WhatsApp.
    return new NextResponse(file, {
      headers: safeFileHeaders({ mimeType: media.mediaMimeType, filename: media.mediaFilename }),
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível abrir a mídia agora." },
      { status: 404 },
    );
  }
}

async function recordMediaAccess(input: { tenantId: string; userId: string; messageId: string }) {
  try {
    const { getDatabase, schema } = await import("@/shared/db");
    const { randomUUID } = await import("node:crypto");
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: input.userId,
      entidade: "whatsapp_message",
      entidadeId: input.messageId,
      acao: "midia_visualizada",
    });
  } catch {
    // Auditing must never block the media response.
  }
}
