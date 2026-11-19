/**
 * Atalho por regras da Sasá agêntica (fase 1): as frases mais comuns viram uma intenção tipada sem chamar
 * a IA (custo zero, funciona com a IA fora). O que não casar aqui vai para o interpretador por IA.
 * Plano: docs/implementations/active/2026-11-19-sasa-agentica.md §2 e §3.1.
 */
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
  | { tool: "lead.stage"; status: SasaStage };

export type SasaTool = SasaIntent["tool"];
export const SASA_TOOLS: readonly SasaTool[] = ["duty.next", "duty.pause", "duty.resume", "leads.waiting", "agenda.list", "returns.schedule", "returns.complete", "returns.cancel", "lead.stage"];

/** A ordem importa: a primeira regra que casar vence (cancelar antes de marcar, pausar antes de plantão). */
export function classifySasaText(input: string): SasaIntent | null {
  const text = normalizePtBr(input).replace(/\s+/g, " ").trim();
  if (!text) return null;
  const aboutReturn = /\b(retorno|retornos|lembrete|lembra|ligar|liga|ligacao)\b/.test(text);

  if (/\b(cancela|cancelar|desmarca|desmarcar|tira|tirar|apaga)\b/.test(text) && aboutReturn) return { tool: "returns.cancel" };
  if (/\b(ja )?(liguei|falei|retornei|conversei)\b/.test(text) || /\b(conclui|concluir|finaliza|finalizar|feito)\b.*\bretorno\b/.test(text) || /\bretorno\b.*\b(feito|concluido)\b/.test(text)) {
    return { tool: "returns.complete" };
  }
  if (/\b(joga|jogar|adia|adiar|remarca|remarcar|passa|passar|muda|mudar|empurra)\b/.test(text) && aboutReturn) return { tool: "returns.schedule", reschedule: true };
  if (/\b(marca|marcar|agenda|agendar|cria|criar|coloca|bota|me lembra|lembrete|lembrar)\b/.test(text) && aboutReturn) return { tool: "returns.schedule", reschedule: false };
  if (/\bretorno com\b|\bretornar (pro|pra|para|o|a|com)\b|\bligar? (pro|pra|para|com)\b/.test(text)) return { tool: "returns.schedule", reschedule: false };

  if (/\b(mandei|enviei|passei|mandou|enviou)\b.*\bcotac/.test(text) || /\bcotacao enviada\b/.test(text)) return { tool: "lead.stage", status: "quote_sent" };
  if (/\b(negociacao|negociando|negociar)\b/.test(text) && !/\?$/.test(text)) return { tool: "lead.stage", status: "negotiation" };
  if (/\b(documentacao|documentos|docs)\b.*\b(pendente|faltando|mandar|enviar)\b|\bpendente de documento/.test(text)) return { tool: "lead.stage", status: "documentation_pending" };

  if (/\b(volta|voltar|volte) a receber\b|\b(despausa|despausar|retoma|retomar)\b|\bquero receber\b|\bme (ativa|libera|despausa)\b/.test(text)) return { tool: "duty.resume" };
  if (/\b(pausa|pausar|pause|me pausa)\b|\b(para|parar) de receber\b|\bnao quero (mais )?receber\b/.test(text)) return { tool: "duty.pause" };

  if (/\b(esperando|aguardando|sem resposta)\b/.test(text) || /\bquem (eu )?(atendo|respondo|devo|tenho que)\b/.test(text)) return { tool: "leads.waiting" };
  if (/\bagenda\b|\bo que (eu )?tenho\b|\bmeus retornos\b|\bretornos (de )?(hoje|amanha|atrasados?)\b|\bcomo (esta|ta) (o )?meu dia\b/.test(text)) return { tool: "agenda.list" };
  if (/\bplantao\b|\bplantoes\b|\bescala\b/.test(text)) return { tool: "duty.next" };
  return null;
}

/** O nome dito, para responder "Não achei Carlos" quando ele não está entre os leads. */
export function nameHintOf(input: string): string | null {
  const match = input.match(/\b(?:com|do|da|de|pro|pra|para|o|a)\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?)/u);
  return match?.[1] ?? null;
}
