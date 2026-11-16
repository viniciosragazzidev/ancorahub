import "server-only";

import { z } from "zod";

import { runGateway } from "@/features/ai-gateway/gateway";
import type { TenantContext } from "@/shared/auth/types";

import { AI_TABLE_ROWS, AI_TEXT_LINES, maskForAi } from "./organize";
import type { StructureAnswer, StructureRequest } from "./parse-contacts";

const tableSchema = z.object({
  header: z.number().int().nullable(),
  name: z.number().int(),
  phone: z.number().int(),
  email: z.number().int().nullable(),
});
const textSchema = z.object({ groups: z.array(z.array(z.number().int()).min(1).max(4)).max(AI_TEXT_LINES) });

const TABLE_PROMPT = [
  "Você organiza listas de contatos de uma corretora de planos de saúde.",
  "Recebe as primeiras linhas de uma planilha. Números viram # e e-mails viram xxx@dominio: só o formato importa.",
  "Responda só JSON: {\"header\": índice da linha de cabeçalho ou null, \"name\": coluna do nome da pessoa, \"phone\": coluna do celular, \"email\": coluna do e-mail ou null}.",
  "Linhas e colunas começam em 0. Nome é nome de gente, nunca operadora, origem (Google) ou responsável.",
].join("\n");

const TEXT_PROMPT = [
  "Você organiza listas de contatos coladas de qualquer jeito (WhatsApp, bloco de notas).",
  "Recebe as linhas numeradas. Números viram # e e-mails viram xxx@dominio: só o formato importa.",
  "Agrupe as linhas que formam o mesmo contato (nome, telefone, e-mail). Linha que não é contato fica de fora.",
  "Responda só JSON: {\"groups\": [[1,2],[3],[5,6,7]]}. No máximo 4 linhas por contato, cada linha em um grupo só.",
].join("\n");

/**
 * Camada 2 da lista da equipe: pede à IA só o MAPA da lista. Os dados chegam mascarados de novo aqui (a tela já
 * mascara) e o gateway ainda mascara telefone e e-mail. `null` = IA indisponível ou resposta inválida.
 */
export async function askListStructure(context: TenantContext, request: StructureRequest): Promise<StructureAnswer | null> {
  const common = {
    profile: "json-structured" as const,
    purpose: "supervisor_list_structure",
    tenantId: context.tenantId,
    userId: context.userId,
    // Nomes de clientes: só modelos pagos que não treinam com os dados (LGPD).
    sensitive: true,
    maskPersonalData: true,
    maxAttempts: 2,
    timeoutMs: 15_000,
    totalTimeoutMs: 25_000,
  };
  if (request.kind === "tabela") {
    const rows = request.rows.slice(0, AI_TABLE_ROWS).map((row) => row.slice(0, 15).map((value) => maskForAi(value)));
    const body = rows.map((row, index) => `${index}: ${row.map((value, column) => `[${column}] ${value || "-"}`).join(" | ")}`).join("\n");
    const result = await runGateway({ ...common, schema: tableSchema, maxTokens: 120, messages: [{ role: "system", content: TABLE_PROMPT }, { role: "user", content: body }] });
    return result.ok ? { kind: "tabela", ...result.value } : null;
  }
  const lines = request.lines.slice(0, AI_TEXT_LINES).map((line) => maskForAi(line));
  const body = lines.map((line, index) => `${index + 1}: ${line}`).join("\n");
  const result = await runGateway({ ...common, schema: textSchema, maxTokens: 2_500, messages: [{ role: "system", content: TEXT_PROMPT }, { role: "user", content: body }] });
  return result.ok ? { kind: "texto", groups: result.value.groups } : null;
}
