import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { VisionNotConfiguredError } from "@/features/ai/vision";
import { ExtractionError, extractDocument } from "@/features/payment-proof-validator/extract";
import { requireCapability } from "@/shared/auth/authorization";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const kindSchema = z.enum(["proposta", "comprovante", "boleto"]);

/** Lê um documento (proposta, comprovante ou boleto). Nada é gravado: o arquivo só existe nesta requisição. */
export async function POST(req: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    await requireCapability(context, "acessar_ferramentas");

    const formData = await req.formData();
    const kind = kindSchema.safeParse(formData.get("kind"));
    const file = formData.get("file");
    if (!kind.success) return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "O arquivo deve ter até 8 MB." }, { status: 400 });
    }
    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ error: "Formato não permitido. Envie PDF, JPG ou PNG." }, { status: 400 });
    }
    if (kind.data !== "comprovante" && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Envie a proposta e o boleto em PDF." }, { status: 400 });
    }

    const document = await extractDocument(kind.data, file, { tenantId: context.tenantId, userId: context.userId });
    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    if (error instanceof ExtractionError || error instanceof VisionNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[validador-comprovante] erro inesperado", error);
    return NextResponse.json({ error: "Não foi possível ler o documento." }, { status: 500 });
  }
}
