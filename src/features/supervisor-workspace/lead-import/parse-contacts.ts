import { lerTelefone } from "@/shared/input/telefone";

/** Lista interna da equipe (16/11/2026): no máximo 50 contatos por importação. */
export const SUPERVISOR_IMPORT_MAX = 50;
/** Limite por dia de cada supervisor, contra abuso. */
export const SUPERVISOR_IMPORT_DAILY_MAX = 300;

export type ParsedContact = {
  /** Linha da lista original (1, 2, 3...), para a pessoa achar o contato. */
  line: number;
  name: string;
  /** 55 + DDD + celular, só dígitos (o mesmo formato da importação do diretor). */
  phone: string | null;
  /** "(21) 99999-9999", para mostrar. */
  phoneLabel: string | null;
  email: string | null;
  problem: string | null;
};

/** O contato depois do "Conferir": `duplicate` = o telefone já está no sistema. */
export type ReviewedContact = ParsedContact & { duplicate: boolean };

/** Respostas do servidor que a gaveta usa (as Server Actions de verdade ou o laboratório). */
export type TeamListApi = {
  review: (text: string) => Promise<{ ok: true; data: { contacts: ReviewedContact[]; overflow: number } } | { ok: false; error: string }>;
  importContacts: (input: { consent: boolean; contacts: Array<{ name: string; phone: string; email: string | null }> }) => Promise<{ ok: true; data: { imported: number; duplicates: number; importId: string; leads: Array<{ id: string; name: string }> } } | { ok: false; error: string }>;
  distribute: (input: { leadIds: string[]; brokerIds: string[]; counts?: Record<string, number> }) => Promise<{ ok: true; data: { distributed: number; left: number; perBroker: Record<string, number> } } | { ok: false; error: string }>;
};

export type ParsedList = {
  contacts: ParsedContact[];
  /** Linhas com contato que passaram do limite de 50 e ficaram para a próxima importação. */
  overflow: number;
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** Sequência que parece telefone: dígitos com espaço, ponto, traço, parênteses e +. */
const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/;
const HEADER = /^(nome|name|contato)\b.*\b(telefone|celular|whats|phone|fone)/i;

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (index > 0 && ["da", "de", "do", "das", "dos", "e"].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function cleanName(value: string) {
  return value
    .replace(/["'`]/g, "")
    .replace(/[;,|\t]+/g, " ")
    .replace(/^[\s\-–•*:.\d)]+/, "")
    .replace(/[\s\-–:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rótulos que vêm em listas copiadas ("Nome: Maria", "Tel: 21 9...", "E-mail: ..."). */
const LABEL = /\b(nome|name|telefone|tel|celular|cel|whatsapp|whats|zap|fone|phone|e-?mail|contato)\s*[:=]\s*/gi;

type Piece = { line: number; name: string; phoneRaw: string | null; email: string | null };

/** O que uma linha tem, ainda sem decidir se é um contato inteiro ou parte de um (nome numa linha, telefone na outra). */
function extract(raw: string, line: number): Piece | null {
  let rest = raw.replace(LABEL, " ").trim();
  if (!rest) return null;
  const email = rest.match(EMAIL)?.[0]?.toLowerCase() ?? null;
  if (email) rest = rest.replace(EMAIL, " ");
  const phoneRaw = rest.match(PHONE)?.[0] ?? null;
  if (phoneRaw) rest = rest.replace(phoneRaw, " ");
  const name = titleCase(cleanName(rest));
  if (!name && !phoneRaw && !email) return null;
  return { line, name, phoneRaw, email };
}

function finish(piece: Piece): ParsedContact {
  const { line, name, phoneRaw, email } = piece;
  const read = phoneRaw ? lerTelefone(phoneRaw) : null;
  const phone = read?.ok && read.celular ? read.e164 : null;
  const problem = !phoneRaw
    ? "Sem telefone."
    : !read?.ok
      ? read!.mensagem
      : !read.celular
        ? "Telefone fixo. Só celular com WhatsApp."
        : name.length < 2
          ? "Sem nome."
          : null;
  return { line, name, phone, phoneLabel: read?.ok ? read.exibicao : phoneRaw, email, problem };
}

/** Uma linha de texto livre (colado do WhatsApp, Excel ou bloco de notas) vira nome, telefone e e-mail. */
export function parseContactLine(raw: string, line: number): ParsedContact | null {
  const piece = extract(raw, line);
  return piece ? finish(piece) : null;
}

/**
 * Junta contato quebrado em linhas: "Maria Silva" numa linha e "(21) 99876-5432" (e/ou o e-mail) nas de baixo,
 * como vem de lista copiada do WhatsApp. Só junta peças que se completam: nome sem telefone + telefone sem nome.
 */
function mergeBrokenContacts(pieces: Piece[]): Piece[] {
  const merged: Piece[] = [];
  for (const piece of pieces) {
    const last = merged.at(-1);
    const lastNeedsPhone = last && last.name.length >= 2 && !last.phoneRaw;
    const lastNeedsName = last && !last.name && last.phoneRaw;
    const isPhoneOnly = !piece.name && piece.phoneRaw;
    const isNameOnly = piece.name.length >= 2 && !piece.phoneRaw;
    const isEmailOnly = !piece.name && !piece.phoneRaw && piece.email;
    if (last && lastNeedsPhone && (isPhoneOnly || (isEmailOnly && !last.email))) {
      merged[merged.length - 1] = { ...last, phoneRaw: last.phoneRaw ?? piece.phoneRaw, email: last.email ?? piece.email };
    } else if (last && lastNeedsName && isNameOnly) {
      merged[merged.length - 1] = { ...last, name: piece.name, email: last.email ?? piece.email };
    } else if (last && isEmailOnly && !last.email && last.phoneRaw) {
      merged[merged.length - 1] = { ...last, email: piece.email };
    } else {
      merged.push(piece);
    }
  }
  return merged;
}

/** Contatos exportados do celular (.vcf): cada cartão vira uma linha "nome  telefone  e-mail". */
export function vcardToLines(text: string): string {
  const unfolded = text.replace(/\r/g, "").replace(/\n[ \t]/g, "");
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  return cards.map((card) => {
    const field = (name: string) => card.split("\n").filter((row) => new RegExp(`^(item\\d+\\.)?${name}[;:]`, "i").test(row)).map((row) => row.slice(row.indexOf(":") + 1).trim());
    const fullName = field("FN")[0] || (field("N")[0] ?? "").split(";").filter(Boolean).reverse().join(" ");
    const tels = card.split("\n").filter((row) => /^(item\d+\.)?TEL[;:]/i.test(row));
    // Celular primeiro: é o que tem WhatsApp.
    const tel = (tels.find((row) => /CELL|MOBILE/i.test(row)) ?? tels[0] ?? "");
    const phone = tel ? tel.slice(tel.indexOf(":") + 1).replace(/^tel:/i, "").trim() : "";
    return [fullName.replace(/\\,/g, ","), phone, field("EMAIL")[0] ?? ""].join("\t");
  }).join("\n");
}

/** O texto inteiro (ou o CSV, ou o .vcf) vira a lista organizada, com no máximo 50 contatos. */
export function parseContactList(text: string, max = SUPERVISOR_IMPORT_MAX): ParsedList {
  const source = /BEGIN:VCARD/i.test(text) ? vcardToLines(text) : text;
  const lines = source.replace(/\r/g, "").split("\n");
  const pieces: Piece[] = [];
  lines.forEach((raw, index) => {
    if (index === 0 && HEADER.test(raw)) return;
    const piece = extract(raw, index + 1);
    if (piece) pieces.push(piece);
  });
  const all = mergeBrokenContacts(pieces).map(finish);
  const contacts = all.slice(0, max);
  const overflow = all.length - contacts.length;
  // Repetido dentro da própria lista: o primeiro fica, os outros avisam.
  const seen = new Set<string>();
  for (const contact of contacts) {
    if (!contact.phone || contact.problem) continue;
    if (seen.has(contact.phone)) contact.problem = "Repetido nesta lista.";
    else seen.add(contact.phone);
  }
  return { contacts, overflow };
}

/**
 * Quantos leads cada corretor recebe. `requested` vazio = dividir igualmente entre os escolhidos (o resto vai um a mais
 * para os primeiros). Com quantidades, a soma nunca passa do total.
 */
export function planShares(total: number, brokerIds: string[], requested?: Record<string, number>): { shares: Array<{ brokerId: string; count: number }>; left: number } {
  if (total <= 0 || !brokerIds.length) return { shares: [], left: Math.max(0, total) };
  if (!requested) {
    const base = Math.floor(total / brokerIds.length);
    const extra = total % brokerIds.length;
    const shares = brokerIds.map((brokerId, index) => ({ brokerId, count: base + (index < extra ? 1 : 0) })).filter((share) => share.count > 0);
    return { shares, left: 0 };
  }
  let left = total;
  const shares: Array<{ brokerId: string; count: number }> = [];
  for (const brokerId of brokerIds) {
    const wanted = Math.max(0, Math.floor(requested[brokerId] ?? 0));
    const count = Math.min(wanted, left);
    if (count > 0) shares.push({ brokerId, count });
    left -= count;
  }
  return { shares, left };
}
