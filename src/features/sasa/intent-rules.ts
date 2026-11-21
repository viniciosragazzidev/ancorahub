/**
 * Atalho por regras da Sasá agêntica (fase 1): as frases mais comuns viram uma intenção tipada sem chamar
 * a IA (custo zero, funciona com a IA fora). O que não casar aqui vai para o interpretador por IA.
 * Plano: docs/implementations/active/2026-11-19-sasa-agentica.md §2 e §3.1.
 */
import { looksLikeQuestion } from "./ecosystem-areas";
import { normalizePtBr } from "./parse-when";

export const SASA_STAGES = ["quote_sent", "negotiation", "documentation_pending"] as const;
export type SasaStage = (typeof SASA_STAGES)[number];
export const SASA_STAGE_LABEL: Record<SasaStage, string> = { quote_sent: "Cotação enviada", negotiation: "Em negociação", documentation_pending: "Documentação pendente" };

export type SasaIntent =
  | { tool: "duty.next" }
  | { tool: "duty.pause" }
  | { tool: "duty.resume" }
  | { tool: "leads.waiting" }
  | { tool: "agenda.list" }
  | { tool: "returns.schedule"; reschedule: boolean }
  | { tool: "returns.complete" }
  | { tool: "returns.cancel" }
  | { tool: "lead.stage"; status: SasaStage }
  /** Fase 4: "a Ana disse que vai ver com o marido" vira nota, com etapa e retorno sugeridos. */
  | { tool: "lead.note" }
  /** Fase 4: "fechou a venda do Carlos" abre o registro da venda já preenchido. */
  | { tool: "sale.start" }
  /** Fase 4: "cotação para 3 vidas, 35, 32 e 8" abre a cotação com as idades. */
  | { tool: "quote.start" }
  /** Fase 5: aceitar ou recusar a oferta de lead novo (confirma em um toque). */
  | { tool: "lead.accept" }
  | { tool: "lead.decline" }
  /** Fase 5: "o Pedro desistiu, achou caro" encerra como perdido (confirma em um toque, com Desfazer depois). */
  | { tool: "lead.lost" }
  /** Fase 5: "manda pra Ana que a proposta sai amanhã" vira rascunho; quem envia é o corretor (D3). */
  | { tool: "message.draft" };

export type SasaTool = SasaIntent["tool"];
export const SASA_TOOLS: readonly SasaTool[] = ["duty.next", "duty.pause", "duty.resume", "leads.waiting", "agenda.list", "returns.schedule", "returns.complete", "returns.cancel", "lead.stage", "lead.note", "sale.start", "quote.start", "lead.accept", "lead.decline", "lead.lost", "message.draft"];

/** Pedidos que escrevem a partir de uma descrição: em forma de pergunta, viram leitura (resposta pelo ecossistema). */
const WRITES_FROM_DESCRIPTION = new Set<SasaTool>(["lead.note", "sale.start", "lead.stage", "quote.start", "lead.lost", "lead.decline", "message.draft"]);

/** Pedido tipado da frase, ou null (pergunta geral, que a Sasá responde lendo os dados do corretor). */
export function classifySasaText(input: string): SasaIntent | null {
  const intent = classifyRaw(input);
  if (intent && WRITES_FROM_DESCRIPTION.has(intent.tool) && looksLikeQuestion(input)) return null;
  return intent;
}

/** A ordem importa: a primeira regra que casar vence (cancelar antes de marcar, pausar antes de plantão). */
function classifyRaw(input: string): SasaIntent | null {
  const text = normalizePtBr(input).replace(/\s+/g, " ").trim();
  if (!text) return null;
  const aboutReturn = /\b(retorno|retornos|lembrete|lembra|ligar|liga|ligacao)\b/.test(text);

  if (/\b(cancela|cancelar|desmarca|desmarcar|tira|tirar|apaga)\b/.test(text) && aboutReturn) return { tool: "returns.cancel" };
  // Pergunta nunca escreve: "o que a Ana disse?" e "quantas vendas eu fiz?" são leituras (ecossistema), não nota nem venda.
  const asking = looksLikeQuestion(input);
  // Fase 5. Rascunho de mensagem: "manda pra Ana que a proposta sai amanhã" (verbo no começo, destinatário e recado).
  if (!asking && MESSAGE_DRAFT.test(text)) return { tool: "message.draft" };
  // Oferta de lead novo: "aceita o lead", "recusa, ele é de outra cidade". "A Ana aceitou a proposta" não casa (aceitou).
  if (!asking && (/^(sasa,? )?(recusa|recusar|recuso|rejeita|rejeitar|dispensa|dispensar)\b/.test(text) || /\b(recusa|recusar|recuso|rejeita|dispensa) (o|a|esse|essa|este|esta) (lead|oferta)\b/.test(text))) return { tool: "lead.decline" };
  if (!asking && (/^(sasa,? )?(aceita|aceitar|aceito|pega|pegar)\b/.test(text) || /\b(aceita|aceitar|aceito|pega|pegar) (o|a|esse|essa|este|esta) (lead|oferta)\b/.test(text))) return { tool: "lead.accept" };
  // Perdido vem antes de venda e de nota: "fechou com outra corretora" não é venda; "achou caro" não é só nota.
  if (!asking && LOST.test(text)) return { tool: "lead.lost" };
  // "Anota que a Ana vai pensar": nota pedida com todas as letras.
  if (!asking && /^(sasa,? )?(anota|anotar|anote|registra|registrar|nota)\b/.test(text)) return { tool: "lead.note" };
  // Venda fechada vem antes de tudo que fala de cliente: "fechou a venda do Carlos, Amil, 3 vidas".
  if (!asking && /\b(fechou|fechei|fechamos|vendi|assinou|assinaram)\b|\bvenda fechada\b|\bfechar a venda\b/.test(text) && !/\b(vai|quer|pode|deve)\s+fechar\b/.test(text)) return { tool: "sale.start" };
  // O que o cliente disse (3ª pessoa): vira nota. "Já falei com a Ana" (1ª pessoa) continua sendo concluir retorno.
  if (!asking && /\b(disse|falou|pediu|respondeu|contou|avisou|comentou|perguntou|reclamou|mandou dizer|achou)\b/.test(text)) return { tool: "lead.note" };
  if (/\b(ja )?(liguei|falei|retornei|conversei)\b/.test(text) || /\b(conclui|concluir|finaliza|finalizar|feito)\b.*\bretorno\b/.test(text) || /\bretorno\b.*\b(feito|concluido)\b/.test(text)) {
    return { tool: "returns.complete" };
  }
  if (/\b(joga|jogar|adia|adiar|remarca|remarcar|passa|passar|muda|mudar|empurra)\b/.test(text) && aboutReturn) return { tool: "returns.schedule", reschedule: true };
  if (/\b(marca|marcar|agenda|agendar|cria|criar|coloca|bota|me lembra|lembrete|lembrar)\b/.test(text) && aboutReturn) return { tool: "returns.schedule", reschedule: false };
  if (/\bretorno com\b|\bretornar (pro|pra|para|o|a|com)\b|\bligar? (pro|pra|para|com)\b/.test(text)) return { tool: "returns.schedule", reschedule: false };

  if (/\b(mandei|enviei|passei|mandou|enviou)\b.*\bcotac/.test(text) || /\bcotacao enviada\b/.test(text)) return { tool: "lead.stage", status: "quote_sent" };
  if (/\b(negociacao|negociando|negociar)\b/.test(text) && !/\?$/.test(text)) return { tool: "lead.stage", status: "negotiation" };
  if (/\b(documentacao|documentos|docs)\b.*\b(pendente|faltando|mandar|enviar)\b|\bpendente de documento/.test(text)) return { tool: "lead.stage", status: "documentation_pending" };

  if (/\b(cotacao|cotar|simula|simular|simulacao)\b/.test(text) && !/\b(mandei|enviei|passei)\b/.test(text)) return { tool: "quote.start" };
  if (/\b(volta|voltar|volte) a receber\b|\b(despausa|despausar|retoma|retomar)\b|\bquero receber\b|\bme (ativa|libera|despausa)\b/.test(text)) return { tool: "duty.resume" };
  if (/\b(pausa|pausar|pause|me pausa)\b|\b(para|parar) de receber\b|\bnao quero (mais )?receber\b/.test(text)) return { tool: "duty.pause" };

  // Leituras rápidas com lista na conversa. Perguntas mais finas (tempo de espera, escala da semana, confirmação,
  // avisos, dinheiro) seguem para as respostas do ecossistema, que trazem esses números.
  const finer = /\b(quanto tempo|ha quanto|semana|escala|confirmad\w*|presenca|avisos?|notificac\w*|novidades?|de novo|whatsapp|vendas?|comiss\w*|receber|recebi)\b/.test(text);
  if (!finer && (/\b(esperando|aguardando|sem resposta)\b/.test(text) || /\bquem (eu )?(atendo|respondo|devo|tenho que)\b/.test(text))) return { tool: "leads.waiting" };
  if (!finer && /\bagenda\b|\bo que (eu )?tenho\b|\bmeus retornos\b|\bretornos? (de )?(hoje|amanha|atrasados?)\b|\bcomo (esta|ta) (o )?meu dia\b/.test(text)) return { tool: "agenda.list" };
  if (!finer && /\bplantao\b|\bplantoes\b/.test(text)) return { tool: "duty.next" };
  return null;
}

const MESSAGE_DRAFT = /^(sasa,? )?(manda|mande|envia|envie|escreve|escreva|avisa|avise|fala|diz|diga)( (uma )?(mensagem|msg|recado))? (pra|pro|para|ao|a|o) [a-z]+\b.*\b(que|dizendo|falando|avisando)\b/;
const LOST = /\b(desistiu|desistiram|perdeu o interesse|nao quer mais|sem interesse|fechou com outr\w*|contratou com outr\w*|ja contratou|ja tem plano|sumiu|nao responde mais|marca (como )?perdid\w*|perdi (o|a) [a-z]+|encerra (o )?atendimento)\b/;

/**
 * Fase 5, vários passos numa frase (intenção 22): "anota que a Ana vai pensar e marca retorno pra sexta" vira dois
 * pedidos. Só corta antes de um verbo de pedido ("e marca", "e muda", "e cancela"); de 2 a 3 passos.
 */
const STEP_VERBS = "marca|marcar|remarca|agenda|agendar|coloca|bota|me lembra|anota|anotar|registra|muda|mudar|passa|joga|cancela|cancelar|desmarca|conclui|concluir|pausa|pausar";
const STEP_SPLIT = new RegExp(`\\s*,?\\s+(?:e depois|e|depois)\\s+(?=(?:${STEP_VERBS})\\b)`, "i");
export function splitSasaSteps(input: string): string[] {
  const parts = input.split(STEP_SPLIT).map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 && parts.length <= 3 ? parts : [input.trim()];
}

/** O nome dito, para responder "Não achei Carlos" quando ele não está entre os leads. */
export function nameHintOf(input: string): string | null {
  const match = input.match(/\b(?:com|do|da|de|pro|pra|para|o|a|chamad[oa]|é|sobre)\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?)/u);
  return match?.[1] ?? null;
}
