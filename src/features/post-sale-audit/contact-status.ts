/**
 * Como foi o contato com o corretor, dito pelo cliente (24/11). Cinco leituras:
 * - talked_ok: falou com o corretor e está seguindo bem;
 * - stalled: teve contato, mas o corretor parou, não concluiu ou não deu continuidade;
 * - no_contact: nunca falou com o corretor;
 * - declined: não quer responder;
 * - other: falou de outra coisa.
 * Casos reais de 24/11 (Toinha e Carmen): "mandou mensagem mas não concluiu", "não deu continuidade" e
 * "não falou mais nada há 2 dias" são falta de continuidade, nunca motivo para repetir a pergunta.
 * Puro, sem I/O: a IA preenche `contactStatus`; se falhar, valem estas palavras-chave.
 */

export const CONTACT_STATUSES = ["talked_ok", "stalled", "no_contact", "declined", "other"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  talked_ok: "Falou com o corretor e foi bem",
  stalled: "Corretor parou ou não concluiu",
  no_contact: "Não teve contato",
  declined: "Não quis responder",
  other: "Outro assunto",
};

function normalize(text: string | null | undefined) {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DECLINED = /\b(prefiro nao (responder|falar|dizer|comentar)|nao quero (responder|comentar|falar sobre isso)|nao vou (responder|comentar)|sem comentarios?)\b/;

/** Teve contato, mas o corretor parou: a conversa começou e não andou. */
const STALLED = new RegExp([
  "nao (conclui\\w*|finaliz\\w*|termin\\w*|continu\\w*|prosseg\\w*)",
  "nao deu (continuidade|sequencia|seguimento|andamento|prosseguimento|mais (retorno|noticia|sinal|resposta))",
  "nao (deu|tive|teve|recebi) (mais )?(nenhum )?retorno",
  "nao (me )?(respondeu|retornou|chamou|procurou|ligou|mandou|enviou|falou) mais",
  "nao (me )?(respondeu|retornou|falou|mandou|enviou) (mais )?nada (mais )?(ha|faz|desde)",
  "(parou|deixou) de (me )?(responder|falar|atender|retornar|mandar)",
  "sumiu",
  "desapareceu",
  "ficou de (me )?(mandar|passar|enviar|retornar|ligar|chamar)\\b.*\\b(nao|nunca|ate hoje|ate agora)",
  "visualiz\\w* e nao",
  "(comecou|iniciou|chegou) a .*\\b(e|mas) (nao|parou)",
  "(mandou|enviou|chamou|falou|ligou) .*\\bmas (nao|parou|depois)",
  "sem (retorno|resposta) (ha|faz|desde)",
  "(ha|faz) \\d+ dias? sem",
  "nao (esta|ta) (me )?(respondendo|retornando|atendendo)",
  "me deixou no vacuo",
  "vacuo",
].map((pattern) => `(?:${pattern})`).join("|"));

const NO_CONTACT = /\b(nao (falei|conversei|consegui falar)|nao (me )?(ligou|chamou|procurou|atendeu|respondeu|contatou)|nao (entrou|entraram) em contato|nao tive (nenhum )?contato|nao recebi (nenhuma )?(mensagem|ligacao|contato)|ninguem (me )?(ligou|chamou|procurou|respondeu|atendeu|entrou em contato|falou comigo)|nunca (me )?(ligou|chamou|respondeu|falou comigo)|ainda nao falei|nao falou comigo)\b/;

const TALKED_OK = /^(sim|s|falei|falei sim|sim falei|consegui|consegui sim|sim consegui|conversei|conversamos|ja|ja falei|falamos|falou sim|claro|com certeza)$|\b(me atendeu (muito )?bem|foi (muito )?(bem|otimo|otima|excelente)|esta me atendendo|estamos (conversando|em contato|falando)|ja (me )?(mandou|enviou|passou) (a )?(cotacao|proposta)|atendimento (otimo|excelente|muito bom)|falei com (ele|ela) sim|tudo certo com (ele|ela))\b/;

/** Leitura por palavras-chave do contato com o corretor; null quando a mensagem não fala disso. */
export function detectContactStatus(text: string | null | undefined): ContactStatus | null {
  const value = normalize(text);
  if (!value) return null;
  if (DECLINED.test(value)) return "declined";
  if (STALLED.test(value)) return "stalled";
  if (NO_CONTACT.test(value)) return "no_contact";
  if (TALKED_OK.test(value)) return "talked_ok";
  return null;
}

/** Leitura final: a da IA vence, mas "stalled" pelas palavras-chave nunca é ignorado (é o caso que gerava o loop). */
export function resolveContactStatus(aiStatus: ContactStatus | null | undefined, text: string | null | undefined): ContactStatus | null {
  const keywords = detectContactStatus(text);
  if (keywords === "stalled" && aiStatus !== "declined" && aiStatus !== "no_contact") return "stalled";
  if (aiStatus && aiStatus !== "other") return aiStatus;
  return keywords ?? aiStatus ?? null;
}
