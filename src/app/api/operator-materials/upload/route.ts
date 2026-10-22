import { after, NextRequest, NextResponse } from "next/server";

import { ingestOperatorFile, MAX_PDF_BYTES, OPERATOR_FILE_MIME_TYPES, type IngestOutcome } from "@/features/operator-catalog/ingest";
import { catalogOperatorSource } from "@/features/operator-catalog/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MESSAGES: Record<IngestOutcome, string> = {
  captured: "Arquivo recebido. A catalogação começa em instantes.",
  duplicate_material: "Este arquivo já foi importado antes.",
  needs_ocr: "Não deu para ler o texto deste PDF. Configure a leitura de imagem (chave Google ou OpenAI) ou envie a versão em texto.",
  needs_vision: "Para ler imagens, configure um provedor com leitura de imagem (chave Google ou OpenAI).",
  no_text: "A imagem não tem texto legível para catalogar.",
  too_large: "O arquivo passa do limite (PDF até 20 MB, imagem até 8 MB).",
  too_small: "O arquivo é pequeno demais para ter conteúdo.",
  expired: "A vigência escrita no material já terminou; ele não foi importado.",
  unsupported: "Formato não aceito. Envie PDF, JPG, PNG ou WEBP.",
  error: "Não foi possível importar este arquivo agora. Tente de novo.",
};

/** One operator file per request (the screen sends several in sequence, each with its own status). Director only. */
export async function POST(request: NextRequest) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return NextResponse.json({ error: "Só o diretor importa material das operadoras." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  if (file.size > MAX_PDF_BYTES) return NextResponse.json({ status: "too_large", message: MESSAGES.too_large }, { status: 400 });
  const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (!OPERATOR_FILE_MIME_TYPES.has(mimeType)) return NextResponse.json({ status: "unsupported", message: MESSAGES.unsupported }, { status: 400 });

  const result = await ingestOperatorFile({
    tenantId: context.tenantId,
    body: Buffer.from(await file.arrayBuffer()),
    fileName: file.name.slice(0, 200),
    mimeType,
    originLabel: "upload",
    uploadedBy: context.userId,
  });
  if (result.status === "captured" && result.sourceId) {
    const sourceId = result.sourceId;
    // Starts right away; the Coolify job picks it up if this run is cut short.
    after(() => catalogOperatorSource(context.tenantId, sourceId).catch(() => undefined));
  }
  const ok = result.status === "captured" || result.status === "duplicate_material";
  return NextResponse.json({ status: result.status, sourceId: result.sourceId ?? null, message: MESSAGES[result.status] }, { status: ok ? 200 : 422 });
}
