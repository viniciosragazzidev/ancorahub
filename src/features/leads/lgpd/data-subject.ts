/**
 * Pedido do titular (LGPD, 26/11/2026): exportar e anonimizar os dados pessoais de um lead e do cliente ligado a ele.
 * Regras puras, sem banco; a action (data-subject-actions.ts) só lê, aplica e audita.
 *
 * Anonimizar troca o nome por "Titular anonimizado" e apaga telefone, e-mail, CPF, nascimento e os campos livres
 * pessoais. Fica tudo o que é número e relatório: etapa, valores, vidas, idades, origem, corretor, unidade, datas,
 * vendas e comissões. Nenhum registro é apagado, e nada financeiro muda.
 *
 * Desde 26/11 também alcança: documentos enviados (marcados como removidos e o arquivo sai do armazenamento),
 * cotações e propostas (nome, telefone, vidas e observações), conversas da IA e da venda automática (texto e
 * transcrição de áudio, que fica no corpo da mensagem) e as anotações livres da venda. O número da apólice fica:
 * a operadora precisa dele.
 */

export const ANONYMIZED_HOLDER_NAME = "Titular anonimizado";
export const ANONYMIZED_BENEFICIARY_NAME = "Beneficiário anonimizado";
export const ANONYMIZED_NOTE_TEXT = "Anotação removida a pedido do titular (LGPD).";
export const ANONYMIZED_MESSAGE_TEXT = "Mensagem removida a pedido do titular (LGPD).";
export const ANONYMIZED_DOCUMENT_FILENAME = "Documento removido a pedido do titular (LGPD)";
export const ANONYMIZED_FREE_TEXT = "Observação removida a pedido do titular (LGPD).";
export const ANONYMIZED_SALE_NOTE_TEXT = "Anotação da venda removida a pedido do titular (LGPD).";
export const ANONYMIZED_AI_TEXT = "Conteúdo da conversa removido a pedido do titular (LGPD).";
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

/** Chaves de texto livre que a IA guarda nos JSONs da conversa (decisão, fatos): saem junto com as pessoais. */
const CONVERSATION_TEXT_KEYS = new Set([
  "reply", "resposta", "answer", "summary", "resumo", "body", "question", "pergunta", "draft", "rascunho", "customermessage", "reason", "motivo",
]);

/** Como scrubPersonalJson, e também sem o texto livre que a IA guarda (resposta, resumo, pergunta). */
export function scrubConversationJson(value: unknown): JsonValue {
  const scrubbed = scrubPersonalJson(value);
  const strip = (item: JsonValue): JsonValue => {
    if (Array.isArray(item)) return item.map(strip);
    if (item && typeof item === "object") {
      const out: Record<string, JsonValue> = {};
      for (const [key, child] of Object.entries(item)) {
        if (CONVERSATION_TEXT_KEYS.has(normalizeKey(key))) continue;
        out[key] = strip(child);
      }
      return out;
    }
    return item;
  };
  return strip(scrubbed);
}

/** Texto livre (nota de venda, observação da cotação, resumo da IA): vazio continua vazio, o resto vira o aviso. */
export function redactFreeText<T extends string>(text: string | null | undefined, notice: T): T | null {
  return typeof text === "string" && text.trim() ? notice : null;
}

/** Troca o nome da pessoa dentro de um texto curto (título da proposta), sem mexer no resto. */
export function redactNameInText(text: string, names: Array<string | null | undefined>) {
  let out = text;
  for (const name of names) {
    const clean = name?.trim();
    if (!clean || clean.length < 3 || clean === ANONYMIZED_HOLDER_NAME) continue;
    out = out.split(clean).join(ANONYMIZED_HOLDER_NAME);
  }
  return out;
}

/**
 * O que a anonimização grava em cada tabela. Só estas colunas mudam; o resto do registro fica como está.
 * Fica sempre: valores (venda, cotação, proposta, comissão), número da apólice, vidas, idades, datas, etapa e dono.
 */
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
    // A chave do arquivo (mediaStorageKey) só sai depois que o arquivo for apagado do armazenamento.
    message: { phone: "", body: ANONYMIZED_MESSAGE_TEXT, mediaFilename: null },
    /** Documento enviado: sem nome nem comentário. Removido da ficha, ou retido quando é prova da venda (ver action). */
    document: { filename: ANONYMIZED_DOCUMENT_FILENAME, description: null, reviewComment: null },
    /** Cotação e proposta: nome e telefone do cliente saem; total, vidas, plano e validade ficam. */
    quote: { leadName: ANONYMIZED_HOLDER_NAME, leadPhone: null },
    proposal: { leadName: ANONYMIZED_HOLDER_NAME, leadPhone: null },
  } as const;
}

/** Cotação: observação livre vira aviso e as vidas perdem o que é pessoal (nome, CPF, nascimento); a idade fica. */
export function anonymizeQuoteRow(row: { notes: string | null; lives: unknown }) {
  return { notes: redactFreeText(row.notes, ANONYMIZED_FREE_TEXT), lives: scrubPersonalJson(row.lives ?? []) };
}

/** Proposta: título sem o nome do cliente e observação livre trocada pelo aviso. */
export function anonymizeProposalRow(row: { title: string; notes: string | null }, names: Array<string | null | undefined>) {
  return { title: redactNameInText(row.title, names), notes: redactFreeText(row.notes, ANONYMIZED_FREE_TEXT) };
}

/** Venda: só as anotações livres. Apólice, valores, vigência, status e comissão não entram no patch. */
export function anonymizeSaleRow(row: { notes: string | null; postSaleNotes: string | null }) {
  return { notes: redactFreeText(row.notes, ANONYMIZED_SALE_NOTE_TEXT), postSaleNotes: redactFreeText(row.postSaleNotes, ANONYMIZED_SALE_NOTE_TEXT) };
}

/** Conversa da IA: resumo e motivo da transferência viram aviso; a memória sai inteira (era sobre a pessoa). */
export function anonymizeAiConversationRow(row: { qualificationSummary: string | null; transferReason: string | null }) {
  return {
    qualificationSummary: redactFreeText(row.qualificationSummary, ANONYMIZED_AI_TEXT),
    transferReason: redactFreeText(row.transferReason, ANONYMIZED_AI_TEXT),
    memory: null,
  };
}

/** Venda automática: fatos sem dado pessoal e o motivo de chamar o gestor vira aviso. Custos e etapa ficam. */
export function anonymizeAutoSaleDealRow(row: { facts: unknown; managerCallReason: string | null }) {
  return { facts: scrubPersonalJson(row.facts ?? {}), managerCallReason: redactFreeText(row.managerCallReason, ANONYMIZED_AI_TEXT) };
}

/** Cada vez da conversa automática: o texto vira aviso, fatos e decisão perdem o texto livre e o pessoal. */
export function anonymizeAutoSaleTurnRow(row: { body: string | null; facts: unknown; decision: unknown }) {
  return {
    body: redactFreeText(row.body, ANONYMIZED_AI_TEXT),
    facts: row.facts === null || row.facts === undefined ? null : scrubConversationJson(row.facts),
    decision: row.decision === null || row.decision === undefined ? null : scrubConversationJson(row.decision),
  };
}

/**
 * Documentos do lead na anonimização. O que é prova da venda (confirmação da operadora ligada à venda, ou evidência
 * usada no financeiro do ERP) fica retido: perde o nome e o comentário, mas o registro e o arquivo continuam, porque
 * a corretora precisa deles para a operadora e a comissão. O resto é marcado como removido e o arquivo sai do
 * armazenamento (inclusive o de documentos que já tinham sido removidos da ficha antes).
 */
export function planLeadDocumentRemoval(
  documents: Array<{ id: string; storageKey: string | null; deletedAt: Date | null }>,
  protectedIds: ReadonlySet<string>,
) {
  const markRemoved: string[] = [];
  const retained: string[] = [];
  const filesToDelete: Array<{ id: string; storageKey: string }> = [];
  for (const document of documents) {
    if (protectedIds.has(document.id)) { retained.push(document.id); continue; }
    if (!document.deletedAt) markRemoved.push(document.id);
    if (document.storageKey) filesToDelete.push({ id: document.id, storageKey: document.storageKey });
  }
  return { markRemoved, retained, filesToDelete };
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
