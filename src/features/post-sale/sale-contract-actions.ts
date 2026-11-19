"use server";

import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { aiExtractImageText, aiExtractPdfText, VisionNotConfiguredError } from "@/features/ai/vision";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { contractInstruction, parseContractReading } from "./sale-contract-reading";
import type { SaleContractReading } from "./conversation-sale-core";

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export type ReadSaleContractResult = { ok: true; reading: SaleContractReading } | { ok: false; error: string };

/**
 * Lê o contrato (foto ou PDF) do registro de venda em conversa e devolve o que achou. Aqui nada é gravado: o
 * arquivo é guardado à parte (/api/documents/upload) e só vira documento do lead quando a venda é registrada.
 * Só o corretor responsável pelo lead pode ler.
 */
export async function readSaleContractAction(formData: FormData): Promise<ReadSaleContractResult> {
  const leadId = String(formData.get("leadId") ?? "");
  const file = formData.get("file");
  if (!leadId || !(file instanceof File)) return { ok: false, error: "Não recebi o arquivo. Tente enviar de novo." };
  if (file.size > MAX_BYTES) return { ok: false, error: "O arquivo passou de 10 MB. Mande uma foto ou um PDF menor." };
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !IMAGE_TYPES.has(file.type)) return { ok: false, error: "Mande uma foto ou um PDF do contrato." };

  const context = await getRequiredTenantContext();
  const [lead] = await getDatabase().select({ corretorId: schema.leads.corretorId }).from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt))).limit(1);
  if (!lead || (context.role === "broker" && lead.corretorId !== context.userId)) return { ok: false, error: "Este lead não está com você." };

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const instruction = contractInstruction(new Date().toISOString().slice(0, 10));
    const { text } = isPdf
      ? await aiExtractPdfText({ pdf: bytes, instruction, maxTokens: 2000 })
      : await aiExtractImageText({ image: bytes, mimeType: file.type, instruction, maxTokens: 2000 });
    const reading = parseContractReading(text);
    if (!reading) return { ok: false, error: "Não consegui ler esse contrato. Tente uma foto mais nítida ou responda as perguntas." };
    return { ok: true, reading };
  } catch (error) {
    if (error instanceof VisionNotConfiguredError) return { ok: false, error: "A leitura de contratos não está ligada agora. Responda as perguntas, é rapidinho." };
    console.error("[registrar-venda] leitura do contrato falhou", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "Não consegui ler o contrato agora. Tente de novo ou responda as perguntas." };
  }
}
