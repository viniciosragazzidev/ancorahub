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
  | { tool: "quote.start" };

export type SasaTool = SasaIntent["tool"];
export const SASA_TOOLS: readonly SasaTool[] = ["duty.next", "duty.pause", "duty.resume", "leads.waiting", "agenda.list", "returns.schedule", "returns.complete", "returns.cancel", "lead.stage", "lead.note", "sale.start", "quote.start"];

/** Pedidos que escrevem a partir de uma descrição: em forma de pergunta, viram leitura (resposta pelo ecossistema). */
const WRITES_FROM_DESCRIPTION = new Set<SasaTool>(["lead.note", "sale.start", "lead.stage", "quote.start"]);

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

/** O nome dito, para responder "Não achei Carlos" quando ele não está entre os leads. */
export function nameHintOf(input: string): string | null {
  const match = input.match(/\b(?:com|do|da|de|pro|pra|para|o|a)\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?)/u);
  return match?.[1] ?? null;
}
