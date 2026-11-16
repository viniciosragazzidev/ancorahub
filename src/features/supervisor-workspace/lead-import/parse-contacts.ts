import { lerTelefone } from "@/shared/input/telefone";

/**
 * Lista interna da equipe. 16/11/2026 (planilha de 4.000 leads): a lista entra inteira de uma vez, com uma só busca
 * de repetidos no banco, em vez de lotes de 50 (cada lote seria uma busca). O freio é por semana.
 */
export const SUPERVISOR_IMPORT_MAX = 5000;
/** Limite de cada supervisor a cada 7 dias. */
export const SUPERVISOR_IMPORT_WEEKLY_MAX = 5000;
/** Quantos leads da lista cada corretor recebe, no máximo, a cada distribuição (16/11). */
export const SUPERVISOR_DISTRIBUTE_PER_BROKER_MAX = 50;
/** A tela grava em blocos deste tamanho (o corpo de uma Server Action vai até 1 MB). */
export const SUPERVISOR_IMPORT_CHUNK = 1000;

export type ParsedContact = {
  /** Linha da lista original (1, 2, 3...), para a pessoa achar o contato. */
  line: number;
  name: string;
  /** 55 + DDD + celular, só dígitos (o mesmo formato da importação do diretor). */
  phone: string | null;
  /** "(21) 99999-9999", para mostrar. */
  phoneLabel: string | null;
  email: string | null;
  /** Colunas que sobraram da planilha (operadora, "Possui CNPJ"...), guardadas na anotação do lead. */
  note: string | null;
  /** O que o sistema arrumou sozinho, para a supervisora ver ("Colocamos o 9 que faltava."). */
  fixed: string | null;
  problem: string | null;
};

/** O que a tela manda para o servidor conferir e importar. O servidor relê tudo. */
export type ContactDraft = { line: number; name: string; phone: string; email: string | null; note: string | null };

/** Pedido de ajuda à IA: só a estrutura, com números e e-mails mascarados. */
export type StructureRequest =
  | { kind: "tabela"; rows: string[][] }
  | { kind: "texto"; lines: string[] };
/** Resposta da IA: o mapa das colunas ou quais linhas formam cada contato. Nunca os dados. */
export type StructureAnswer =
  | { kind: "tabela"; header: number | null; name: number; phone: number; email: number | null }
  | { kind: "texto"; groups: number[][] };

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** O contato depois do "Conferir": `duplicate` = o telefone já está no sistema. */
export type ReviewedContact = ParsedContact & { duplicate: boolean };

/** Respostas do servidor que a gaveta usa (as Server Actions de verdade ou o laboratório). */
export type TeamListApi = {
  /** Só quando a leitura automática fica em dúvida. `null` = IA indisponível: segue a leitura automática. */
  structure: (request: StructureRequest) => Promise<Result<StructureAnswer | null>>;
  /** Uma busca só: quais desses celulares (55DDDnúmero) já estão no CRM. Devolve os que já estão. */
  review: (phones: string[]) => Promise<Result<{ known: string[]; weekLeft: number }>>;
  /** Um bloco de até SUPERVISOR_IMPORT_CHUNK. `importId` junta os blocos da mesma lista. */
  importContacts: (input: { consent: boolean; importId: string; contacts: Array<Omit<ContactDraft, "line">> }) => Promise<Result<{ imported: number; duplicates: number }>>;
  /** Quantos leads cada corretor recebe. O servidor escolhe os mais antigos da lista. */
  distribute: (input: { counts: Record<string, number>; leadIds?: string[] }) => Promise<Result<{ distributed: number; left: number; perBroker: Record<string, number> }>>;
};

export type ParsedList = {
  contacts: ParsedContact[];
  /** Linhas com contato que passaram do limite de 50 e ficaram para a próxima importação. */
  overflow: number;
};

export const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** Sequência que parece telefone: dígitos com espaço, ponto, traço, parênteses e +. */
export const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/;
const HEADER = /^(nome|name|contato|cliente)\b.*\b(telefone|celular|whats|phone|fone|contato)/i;

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (index > 0 && ["da", "de", "do", "das", "dos", "e"].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function cleanName(value: string) {
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

/** Monta o contato e diz o que está errado. Usado pela tela, pela leitura da planilha e de novo pelo servidor. */
export function buildContact(input: { line: number; name: string; phoneRaw: string | null; email: string | null; note?: string | null }): ParsedContact {
  const { line, name, phoneRaw, email } = input;
  const read = phoneRaw ? lerTelefone(phoneRaw) : null;
  const phone = read?.ok && read.celular ? read.e164 : null;
  // Celular antigo com 8 dígitos: lerTelefone já coloca o 9; a supervisora vê que foi corrigido.
  const national = (phoneRaw ?? "").replace(/\D/g, "").replace(/^0+/, "").replace(/^55(?=\d{10,11}$)/, "");
  const fixed = phone && national.length === 10 ? "Colocamos o 9 que faltava." : null;
  const problem = !phoneRaw
    ? "Sem telefone."
    : !read?.ok
      ? read!.mensagem
      : !read.celular
        ? "Telefone fixo. Só celular com WhatsApp."
        : name.length < 2
          ? "Sem nome."
          // Mensagem colada no lugar do nome ("Bom dia! Eu já possuo plano..."): fica de fora, não derruba o bloco.
          : name.length > 80 || name.split(/\s+/).length > 8
            ? "Parece uma mensagem, não um nome."
            : null;
  return { line, name, phone, phoneLabel: read?.ok ? read.exibicao : phoneRaw, email, note: input.note?.trim() ? input.note.trim().slice(0, 300) : null, fixed, problem };
}

function finish(piece: Piece): ParsedContact {
  return buildContact(piece);
}

/** Repetido dentro da própria lista: o primeiro fica, os outros avisam. */
export function markRepeated(contacts: ParsedContact[]) {
  const seen = new Set<string>();
  for (const contact of contacts) {
    if (!contact.phone || contact.problem) continue;
    if (seen.has(contact.phone)) contact.problem = "Repetido nesta lista.";
    else seen.add(contact.phone);
  }
  return contacts;
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
  const contacts = markRepeated(all.slice(0, max));
  const overflow = all.length - contacts.length;
  return { contacts, overflow };
}

/**
 * Quantos leads cada corretor recebe. `requested` vazio = dividir igualmente entre os escolhidos (o resto vai um a mais
 * para os primeiros). Com quantidades, a soma nunca passa do total.
 */
export function planShares(total: number, brokerIds: string[], requested?: Record<string, number>, cap = SUPERVISOR_DISTRIBUTE_PER_BROKER_MAX): { shares: Array<{ brokerId: string; count: number }>; left: number } {
  if (total <= 0 || !brokerIds.length) return { shares: [], left: Math.max(0, total) };
  if (!requested) {
    // Dividir igual, sem passar do limite por corretor: o que não couber fica para a próxima distribuição.
    const room = Math.min(total, cap * brokerIds.length);
    const base = Math.floor(room / brokerIds.length);
    const extra = room % brokerIds.length;
    const shares = brokerIds.map((brokerId, index) => ({ brokerId, count: base + (index < extra ? 1 : 0) })).filter((share) => share.count > 0);
    return { shares, left: total - room };
  }
  let left = total;
  const shares: Array<{ brokerId: string; count: number }> = [];
  for (const brokerId of brokerIds) {
    const wanted = Math.min(cap, Math.max(0, Math.floor(requested[brokerId] ?? 0)));
    const count = Math.min(wanted, left);
    if (count > 0) shares.push({ brokerId, count });
    left -= count;
  }
  return { shares, left };
}
