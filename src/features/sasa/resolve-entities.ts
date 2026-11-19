/**
 * "o Carlos" → qual lead. Puro, sobre a lista que o servidor já carregou dentro do escopo do corretor
 * (só os leads dele, do tenant da sessão): um lead de outro corretor nem aparece aqui.
 * Nome completo vence; primeiro nome vence sobrenome solto; empate de verdade vira escolha por toque (plano §3.3).
 * Leads sem nome real ("Lead sem nome", "Lead WhatsApp (…)", só telefone) ficam fora: não dá para chamar ninguém por eles.
 */
import { LEAD_WITHOUT_NAME } from "@/features/leads/webhooks/schemas/lp-form-payload.schema";

import { normalizePtBr } from "./parse-when";

export type SasaLead = { id: string; name: string; status: string };
export type LeadMatch<T extends SasaLead = SasaLead> = { kind: "one"; lead: T } | { kind: "many"; leads: T[] } | { kind: "none" };

/** Conectivos dentro de nomes ("Tatianne de Sousa"). */
const STOP = new Set(["de", "da", "do", "das", "dos", "e"]);
/** Palavras da pergunta que nunca são nome ("tem algum lead chamado Antônia?"). */
const QUESTION_WORDS = new Set([
  "lead", "leads", "cliente", "clientes", "contato", "chamado", "chamada", "chamados", "chamadas", "nome", "algum", "alguma", "alguem", "tem", "tenho", "existe",
  "meu", "minha", "meus", "minhas", "os", "as", "com", "sobre", "quem", "esta", "estao", "como", "qual", "quais", "um", "uma", "me", "fala", "conta", "mostra",
  "abre", "abrir", "ver", "pra", "para", "que", "ai", "ela", "ele", "sasa", "resume", "resumo", "procura", "acha", "busca", "aqui", "lista",
]);
const MAX_CHOICES = 4;

/**
 * Nome provisório, sem pessoa por trás: o "Lead sem nome" da entrada por formulário (`LEAD_WITHOUT_NAME`), o
 * "Lead WhatsApp (…)" que a fila e a carteira já escondem (`buildBrokerWalletLeadWhere`), vazio ou só telefone.
 */
export function isProvisionalLeadName(name: string | null | undefined) {
  const text = normalizePtBr(name ?? "").trim();
  if (!text) return true;
  if (text === normalizePtBr(LEAD_WITHOUT_NAME) || /^(lead )?sem nome$/.test(text) || /^lead whatsapp\b/.test(text)) return true;
  return /^[\d\s()+\-.]+$/.test(text);
}

function words(text: string) {
  return normalizePtBr(text).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 2 && !STOP.has(word));
}

/** 4: nome completo; 3: duas partes; 2: primeiro nome; 1: só um sobrenome. */
function score(lead: SasaLead, spoken: Set<string>, spokenText: string) {
  const parts = words(lead.name);
  if (!parts.length) return 0;
  const full = parts.join(" ");
  if (parts.length > 1 && ` ${spokenText} `.includes(` ${full} `)) return 4;
  const hits = parts.filter((part) => spoken.has(part)).length;
  if (hits >= 2) return 3;
  if (spoken.has(parts[0]!)) return 2;
  return hits ? 1 : 0;
}

export function resolveLead<T extends SasaLead>(text: string, leads: T[], hint?: string | null): LeadMatch<T> {
  const source = [text, hint ?? ""].join(" ");
  const spokenWords = words(source).filter((word) => !QUESTION_WORDS.has(word));
  const spoken = new Set(spokenWords);
  const spokenText = spokenWords.join(" ");
  let best = 0;
  let found: T[] = [];
  for (const lead of leads) {
    if (isProvisionalLeadName(lead.name)) continue;
    const value = score(lead, spoken, spokenText);
    if (value > best) { best = value; found = [lead]; }
    else if (value === best && value > 0) found.push(lead);
  }
  if (!best) return { kind: "none" };
  if (found.length === 1) return { kind: "one", lead: found[0]! };
  return { kind: "many", leads: found.slice(0, MAX_CHOICES) };
}

/** "Carlos Teixeira" → "Carlos". */
export function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
