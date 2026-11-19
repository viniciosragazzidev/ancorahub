"use server";

import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { aiExtractImageText, aiExtractPdfText, VisionNotConfiguredError } from "@/features/ai/vision";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { parseContractReading } from "./sale-contract-reading";
import type { SaleContractReading } from "./conversation-sale-core";

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const INSTRUCTION = `Você lê contratos e propostas de plano de saúde do Brasil. Responda SOMENTE com um JSON, sem texto antes ou depois, neste formato:
{"planType": "individual" | "familiar" | "pme" | "empresarial" | null,
 "ages": [idade do titular, idades dos dependentes...] ou null,
 "carrierName": "nome da operadora" ou null,
 "planName": "nome comercial do plano" ou null,
 "monthlyValue": valor mensal total em reais como número (ex.: 1250.9) ou null,
 "coverageStartDate": "AAAA-MM-DD" do início da vigência ou null}
Regras: idades em anos inteiros (se só houver data de nascimento, calcule a idade hoje, ${new Date().toISOString().slice(0, 10)}); o titular sempre primeiro; o valor é a mensalidade somando todas as vidas, não a taxa de adesão; use null no que não estiver escrito. Não invente.`;

export type ReadSaleContractResult = { ok: true; reading: SaleContractReading } | { ok: false; error: string };

/**
 * Lê o contrato (foto ou PDF) do registro de venda em conversa e devolve o que achou. Nada é gravado: o arquivo
 * só passa pela IA (documentos ficam para a segunda fase). Só o corretor responsável pelo lead pode ler.
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
    const { text } = isPdf
      ? await aiExtractPdfText({ pdf: bytes, instruction: INSTRUCTION, maxTokens: 1200 })
      : await aiExtractImageText({ image: bytes, mimeType: file.type, instruction: INSTRUCTION, maxTokens: 1200 });
    const reading = parseContractReading(text);
    if (!reading) return { ok: false, error: "Não consegui ler esse contrato. Tente uma foto mais nítida ou responda as perguntas." };
    return { ok: true, reading };
  } catch (error) {
    if (error instanceof VisionNotConfiguredError) return { ok: false, error: "A leitura de contratos não está ligada agora. Responda as perguntas, é rapidinho." };
    console.error("[registrar-venda] leitura do contrato falhou", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "Não consegui ler o contrato agora. Tente de novo ou responda as perguntas." };
  }
}
