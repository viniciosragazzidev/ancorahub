/**
 * Perguntas para a direção (26/11/2026): regras puras, sem I/O, seguras no cliente.
 *
 * Quando o lead pergunta algo no meio da qualificação e a IA não sabe (cobertura de hospital, MEI, carência de um
 * plano), ela não inventa: responde HOLD_REPLY e a pergunta vai para o diretor em /ia/perguntas. A resposta do
 * diretor pode ir ao lead e virar conhecimento da IA; da próxima vez a IA responde sozinha com ela.
 */
import { learningKey, scrubPersonalData } from "@/features/situation-learning/learning";

/** O que o lead recebe enquanto a direção não responde. Neutro: não promete nem nega nada. */
export const DIRECTION_HOLD_REPLY = "Vou confirmar isso com a equipe e já te retorno.";

export const DIRECTION_ANSWER_MAX = 1000;

/** Pergunta de fato específico que só a operadora ou a direção confirmam (cobertura, rede, carência, aceite). */
const SPECIFIC_FACT = /\b(cobre|cobrem|cobertura|hospita\w*|rede|credenciad\w*|car[eê]ncias?|reembolso|cnpj|mei|aceita\w*|laborat[oó]rio\w*|cl[ií]nicas?|exames?|cirurgias?|parto|obst[eé]tric\w*|coparticipa\w*|portabilidade|preexistente\w*|cpt|abrang[eê]ncia|odonto\w*|terapias?|psic[oó]log\w*|fisioterapia|home care|uti)\b/i;

/** Preço segue o caminho de sempre (o corretor cota): não vira pergunta para a direção. */
const PRICE_QUESTION = /\b(quanto (custa|fica|sai|[eé])|pre[cç]o|valor(es)?|mensalidade|or[cç]amento|cota[cç][aã]o)\b/i;

/** A resposta lateral da IA só adiou ("o corretor vai detalhar isso na cotação"): ela não sabia. */
const DEFERRAL = /(vai detalhar|v[aã]o detalhar|na cota[cç][aã]o|n[aã]o (tenho|sei|consigo)|n[aã]o possuo|sem essa informa[cç][aã]o|confirmar com)/i;

export function isSpecificFactQuestion(text: string) {
  return SPECIFIC_FACT.test(text) && !PRICE_QUESTION.test(text);
}

export function lateralAnswerDefers(answer: string | null | undefined) {
  return Boolean(answer && DEFERRAL.test(answer));
}

/**
 * A pergunta vai para a direção? Só quando a IA não soube: a resposta lateral adiou, ou não saiu nenhuma e a pergunta
 * é de fato específico. Pergunta de preço e resposta que a IA deu de verdade seguem como antes.
 */
export function shouldAskDirection(question: string, lateralAnswer: string | null | undefined) {
  if (!question.trim() || PRICE_QUESTION.test(question)) return false;
  if (lateralAnswerDefers(lateralAnswer)) return true;
  return !lateralAnswer && isSpecificFactQuestion(question);
}

/** Texto guardado: sem e-mail, documento, telefone ou link do lead. */
export function cleanDirectionQuestion(question: string) {
  return scrubPersonalData(question).slice(0, 500);
}

export function normalizeDirectionQuestion(question: string) {
  return learningKey(question);
}

const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "para", "pra",
  "por", "com", "que", "se", "me", "meu", "minha", "voces", "voce", "vcs", "vc", "ai", "la", "isso", "esse", "essa", "tem",
  "ter", "ou", "ao", "aos", "eu", "ele", "ela", "sim", "nao", "qual", "quais", "como", "oi", "ola", "bom", "dia", "tarde", "noite",
]);

/** Plural e terceira do plural contam como a mesma palavra ("aceitam" = "aceita", "planos" = "plano"). */
function stem(word: string) {
  return word.length > 4 ? word.replace(/(m|s)$/, "") : word;
}

function keywords(question: string) {
  return new Set(normalizeDirectionQuestion(question).split(" ").filter((word) => word.length > 1 && !STOPWORDS.has(word)).map(stem));
}

/** Parecença entre duas perguntas (Jaccard das palavras que importam), de 0 a 1. */
export function questionSimilarity(a: string, b: string) {
  const left = keywords(a);
  const right = keywords(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export const TAUGHT_MATCH_THRESHOLD = 0.6;

export type TaughtAnswer = { question: string; answer: string };

/** Resposta ensinada pela direção para uma pergunta parecida, ou null. A mais parecida ganha. */
export function findTaughtAnswer(question: string, taught: readonly TaughtAnswer[]) {
  let best: { answer: string; score: number } | null = null;
  for (const item of taught) {
    const answer = item.answer.trim();
    if (!answer) continue;
    const score = questionSimilarity(question, item.question);
    if (score >= TAUGHT_MATCH_THRESHOLD && (!best || score > best.score)) best = { answer, score };
  }
  return best?.answer ?? null;
}

export type ExcerptLine = { from: "lead" | "ia" | "equipe"; text: string; at: string | null };

/** Uma mensagem da conversa no trecho da gaveta: quem falou, o texto (sem dado pessoal) e quando. */
export function toExcerptLine(message: { direction: string | null; senderRole: string | null; body: string | null; sentAt: Date | string | null }): ExcerptLine | null {
  const text = scrubPersonalData(message.body ?? "").slice(0, 500);
  if (!text) return null;
  const inbound = message.direction === "incoming" || message.direction === "inbound";
  const from: ExcerptLine["from"] = inbound ? "lead" : message.senderRole === "assistant" || message.senderRole === "system" ? "ia" : "equipe";
  const at = message.sentAt ? new Date(message.sentAt).toISOString() : null;
  return { from, text, at };
}

export function parseExcerpt(value: unknown): ExcerptLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const line = item as Partial<ExcerptLine>;
    if (typeof line.text !== "string" || !line.text) return [];
    const from = line.from === "lead" || line.from === "ia" || line.from === "equipe" ? line.from : "equipe";
    return [{ from, text: line.text, at: typeof line.at === "string" ? line.at : null }];
  });
}

export const EXCERPT_SPEAKER: Record<ExcerptLine["from"], string> = { lead: "Lead", ia: "IA", equipe: "Equipe" };

/** Quem responde: o diretor (empresa toda) e o gestor de unidade (só os leads da unidade). */
export function canAnswerDirectionQuestions(role: string, jobTitle?: string | null) {
  if (role === "director") return true;
  return role === "manager" && !(jobTitle === "marketing" || jobTitle === "finance");
}

/** "Ensinar a IA" (base de conhecimento da empresa toda) é só do diretor; o gestor responde e envia ao lead. */
export function canTeachDirectionAnswers(role: string) {
  return role === "director";
}

export type DirectionAnswerInput = { id: string; answer: string; sendToLead: boolean; teach: boolean };

/** Confere a resposta antes de qualquer envio. Devolve o texto limpo ou a causa em pt-BR. */
export function validateDirectionAnswer(input: DirectionAnswerInput): { ok: true; answer: string } | { ok: false; error: string } {
  const answer = input.answer.replace(/\s+\n/g, "\n").trim();
  if (!input.id) return { ok: false, error: "Pergunta não encontrada." };
  if (answer.length < 2) return { ok: false, error: "Escreva a resposta antes de enviar." };
  if (answer.length > DIRECTION_ANSWER_MAX) return { ok: false, error: `A resposta pode ter até ${DIRECTION_ANSWER_MAX} caracteres.` };
  return { ok: true, answer };
}

/** O que vira conhecimento da IA: pergunta e resposta da direção, num texto que a busca do catálogo encontra. */
export function buildTaughtKnowledge(input: { question: string; answer: string; carrierName?: string | null }) {
  const subject = input.question.replace(/\s+/g, " ").trim();
  const title = `Resposta da direção: ${subject.length > 120 ? `${subject.slice(0, 117).trimEnd()}…` : subject}`;
  const content = [
    input.carrierName ? `Operadora: ${input.carrierName}.` : null,
    `Pergunta de cliente: ${subject}`,
    `Resposta confirmada pela direção: ${input.answer.trim()}`,
  ].filter(Boolean).join("\n");
  return { title, content };
}

/** Operadora citada na pergunta (nome do catálogo da empresa), para a resposta valer na busca dessa operadora. */
export function carrierNamedIn(question: string, carriers: readonly { id: string; name: string }[]) {
  const text = ` ${normalizeDirectionQuestion(question)} `;
  return carriers.find((carrier) => {
    const name = normalizeDirectionQuestion(carrier.name);
    return name.length >= 3 && text.includes(` ${name} `);
  }) ?? null;
}

export type DirectionQuestionRow = {
  id: string;
  createdAt: string;
  leadId: string | null;
  leadName: string | null;
  question: string;
  status: "open" | "answered";
  answer: string | null;
  answeredAt: string | null;
  answeredByName: string | null;
  sentToLeadAt: string | null;
  taught: boolean;
  transport: string;
  excerpt: ExcerptLine[];
};

export type DirectionQuestionTab = "open" | "answered";

export function directionStatusView(status: DirectionQuestionRow["status"]) {
  return status === "open" ? { label: "Aberta", tone: "warning" as const } : { label: "Respondida", tone: "success" as const };
}

export function directionQuestionsForTab(rows: readonly DirectionQuestionRow[], tab: DirectionQuestionTab) {
  return rows.filter((row) => row.status === tab);
}

const CHANNEL_LABEL: Record<string, string> = { meta: "WhatsApp oficial (Meta)", waha: "WhatsApp da empresa (WAHA)", openwa: "WhatsApp conectado" };

export function directionChannelLabel(transport: string) {
  return CHANNEL_LABEL[transport] ?? "canal da conversa";
}

/** Frase do que aconteceu com a resposta, para a gaveta e o aviso de sucesso. */
export function describeDirectionOutcome(row: Pick<DirectionQuestionRow, "sentToLeadAt" | "taught">) {
  const parts = [row.sentToLeadAt ? "enviada ao lead" : null, row.taught ? "ensinada à IA" : null].filter(Boolean);
  if (!parts.length) return "Resposta guardada.";
  const sentence = parts.join(" e ");
  return `Resposta ${sentence}.`;
}
