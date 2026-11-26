/**
 * Pedido do titular (LGPD, 26/11/2026): exportar e anonimizar os dados pessoais de um lead e do cliente ligado a ele.
 * Regras puras, sem banco; a action (data-subject-actions.ts) só lê, aplica e audita.
 *
 * Anonimizar troca o nome por "Titular anonimizado" e apaga telefone, e-mail, CPF, nascimento e os campos livres
 * pessoais. Fica tudo o que é número e relatório: etapa, valores, vidas, idades, origem, corretor, unidade, datas,
 * vendas e comissões. Nenhum registro é apagado, e nada financeiro muda.
 */

export const ANONYMIZED_HOLDER_NAME = "Titular anonimizado";
export const ANONYMIZED_BENEFICIARY_NAME = "Beneficiário anonimizado";
export const ANONYMIZED_NOTE_TEXT = "Anotação removida a pedido do titular (LGPD).";
export const ANONYMIZED_MESSAGE_TEXT = "Mensagem removida a pedido do titular (LGPD).";
export const ANONYMIZE_CONFIRMATION_WORD = "ANONIMIZAR";
export const MIN_ANONYMIZE_REASON_LENGTH = 5;
export const MAX_ANONYMIZE_REASON_LENGTH = 500;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Chaves (sem acento, sem _ - e espaço, minúsculas) que guardam dado pessoal ou texto livre sobre a pessoa. */
const PERSONAL_KEYS = new Set([
  "nome", "name", "fullname", "nomecompleto", "firstname", "lastname", "primeironome", "sobrenome", "nomemae", "nomedamae", "mae",
  "telefone", "phone", "phonenumber", "celular", "whatsapp", "mobile", "fone", "tel",
  "email", "mail", "emailaddress",
  "cpf", "rg", "documento", "document", "cnh", "cartaosus", "cns",
  "nascimento", "datanascimento", "datadenascimento", "birth", "birthdate", "birthday", "dob",
  "endereco", "address", "logradouro", "rua", "complemento", "cep", "zipcode", "postalcode", "bairro", "neighborhood",
  "observacao", "observacoes", "obs", "mensagem", "message", "comentario", "comentarios", "comments", "notes", "nota", "notas",
  "resumoatendimento", "resumonecessidade", "beneficiaryraw", "text", "texto", "transcricao", "transcript",
]);

function normalizeKey(key: string) {
  return key.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s_\-.]/g, "").toLowerCase();
}

export function isPersonalKey(key: string) {
  const normalized = normalizeKey(key);
  if (PERSONAL_KEYS.has(normalized)) return true;
  // "cpf_titular", "telefone2", "email_contato": o termo pessoal manda, mesmo com prefixo ou sufixo.
  return /cpf|telefone|celular|whatsapp|email|phone|nascimento|birth/.test(normalized);
}

function isFieldEntry(item: unknown): item is { name: string } {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const record = item as Record<string, unknown>;
  return typeof record.name === "string" && Array.isArray(record.values);
}

/**
 * Tira de um JSON (formData, qualificação, metadados da origem) as chaves pessoais, em qualquer nível. O formato do
 * Lead Ads ({ name: "full_name", values: [...] }) sai inteiro quando o campo é pessoal.
 */
export function scrubPersonalJson(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(isFieldEntry(item) && isPersonalKey(item.name)))
      .map((item) => scrubPersonalJson(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    // Num campo do Lead Ads não pessoal, "name" é o nome do campo (qtd_vidas), não o da pessoa.
    const fieldEntry = isFieldEntry(value);
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (fieldEntry && key === "name") { out[key] = item as string; continue; }
      if (isPersonalKey(key)) continue;
      out[key] = scrubPersonalJson(item);
    }
    return out;
  }
  if (value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return null;
}

/** O que a anonimização grava em cada tabela. Só estas colunas mudam; o resto do registro fica como está. */
export function buildLeadAnonymization(input: { formData?: unknown; qualificationDetails?: unknown; sourceMetadata?: unknown }) {
  return {
    lead: {
      nome: ANONYMIZED_HOLDER_NAME,
      telefone: "",
      email: null,
      formData: scrubPersonalJson(input.formData ?? {}),
      qualificationDetails: scrubPersonalJson(input.qualificationDetails ?? {}),
      sourceMetadata: input.sourceMetadata === null || input.sourceMetadata === undefined ? null : scrubPersonalJson(input.sourceMetadata),
      distributionRemovalNote: null,
    },
    client: { nome: ANONYMIZED_HOLDER_NAME, telefone: "", email: null },
    beneficiary: { name: ANONYMIZED_BENEFICIARY_NAME, cpf: null, birthDate: null },
    note: { conteudo: ANONYMIZED_NOTE_TEXT },
    message: { phone: "", body: ANONYMIZED_MESSAGE_TEXT, mediaFilename: null },
  } as const;
}

export type DataSubjectCheck = { ok: true } | { ok: false; error: string };

/** Só o diretor, e só lead da própria empresa. Lead de outra empresa responde como inexistente. */
export function checkDataSubjectAccess(context: { role: string; tenantId: string }, lead: { tenantId: string } | null | undefined): DataSubjectCheck {
  if (context.role !== "director") return { ok: false, error: "Só o diretor atende pedidos do titular." };
  if (!lead || lead.tenantId !== context.tenantId) return { ok: false, error: "Lead não encontrado." };
  return { ok: true };
}

export function validateAnonymizeRequest(input: { confirmation: unknown; reason: unknown }): { ok: true; reason: string } | { ok: false; error: string } {
  const confirmation = typeof input.confirmation === "string" ? input.confirmation.trim() : "";
  if (confirmation !== ANONYMIZE_CONFIRMATION_WORD) return { ok: false, error: `Digite ${ANONYMIZE_CONFIRMATION_WORD} para confirmar.` };
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < MIN_ANONYMIZE_REASON_LENGTH) return { ok: false, error: "Escreva o motivo do pedido." };
  if (reason.length > MAX_ANONYMIZE_REASON_LENGTH) return { ok: false, error: `O motivo pode ter até ${MAX_ANONYMIZE_REASON_LENGTH} caracteres.` };
  return { ok: true, reason };
}

export function isLeadAnonymized(lead: { nome: string; telefone: string }) {
  return lead.nome === ANONYMIZED_HOLDER_NAME && lead.telefone === "";
}

/** Nome do arquivo exportado, sem dado pessoal: o id do lead e o dia em Brasília. */
export function dataSubjectExportFilename(leadId: string, now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return `titular-${leadId.slice(0, 8)}-${day}.json`;
}
