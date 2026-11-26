/**
 * Contato interno (DeskComm 7.4, "contato interno fora de lead e IA"): quem é da casa não vira lead, não entra na
 * qualificação nem na distribuição quando escreve no número oficial ou no WhatsApp da empresa. Interno é o telefone
 * de um membro ativo da equipe ou um número da lista "Números internos" do diretor (fornecedores, operadoras, família).
 * Puro, sem I/O: o servidor monta o diretório e cada webhook só pergunta "é interno?".
 */

export type InternalNumber = { phone: string; label: string };

export type InternalDirectory = {
  team: ReadonlyMap<string, string>;
  list: ReadonlyMap<string, string>;
};

export type InternalDecision =
  | { internal: false }
  | { internal: true; reason: "team_member" | "internal_list"; label: string };

export const MAX_INTERNAL_NUMBERS = 200;
export const MAX_INTERNAL_LABEL_LENGTH = 60;

/**
 * Chave de comparação de um telefone do Brasil: DDD + os 8 últimos dígitos. Assim "+55 21 99646-2596",
 * "21 99646-2596", "5521 9646-2596" (sem o 9) e "5521996462596@c.us" são o mesmo número. Fixo de 10 dígitos
 * também cabe. Devolve null para o que não é telefone do Brasil (curto, longo, ID @lid).
 */
export function internalPhoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).split("@")[0].replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith("55")) return null;
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  const ddd = digits.slice(0, 2);
  if (ddd[0] === "0" || ddd[1] === "0") return null;
  return `${ddd}${digits.slice(-8)}`;
}

/** Mesmo telefone, com ou sem 55 e com ou sem o 9. */
export function sameInternalPhone(a: string | null | undefined, b: string | null | undefined) {
  const left = internalPhoneKey(a);
  return Boolean(left) && left === internalPhoneKey(b);
}

/** Lê o valor guardado (JSON) sem quebrar: entradas inválidas caem fora, repetidas ficam só uma vez. */
export function parseInternalNumbers(value: string | null | undefined): InternalNumber[] {
  if (!value) return [];
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const result: InternalNumber[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const phone = typeof (item as { phone?: unknown }).phone === "string" ? (item as { phone: string }).phone : "";
    const key = internalPhoneKey(phone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const label = typeof (item as { label?: unknown }).label === "string" ? (item as { label: string }).label.trim().slice(0, MAX_INTERNAL_LABEL_LENGTH) : "";
    result.push({ phone, label });
    if (result.length >= MAX_INTERNAL_NUMBERS) break;
  }
  return result;
}

export type ParsedInternalLines = { numbers: InternalNumber[]; invalid: string[]; repeated: string[] };

/**
 * O que o diretor digita, uma linha por número: o telefone e, se quiser, quem é ("(21) 99999-0000 Fornecedor").
 * O telefone fica guardado só com dígitos e o 55.
 */
export function parseInternalNumberLines(text: string): ParsedInternalLines {
  const numbers: InternalNumber[] = [];
  const invalid: string[] = [];
  const repeated: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^[+\d\s().-]+/);
    const phonePart = match?.[0] ?? "";
    const key = internalPhoneKey(phonePart);
    if (!key) {
      invalid.push(line);
      continue;
    }
    if (seen.has(key)) {
      repeated.push(line);
      continue;
    }
    seen.add(key);
    const digits = phonePart.replace(/\D/g, "");
    const phone = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
    const label = line.slice(phonePart.length).replace(/^[\s·,;:-]+/, "").trim().slice(0, MAX_INTERNAL_LABEL_LENGTH);
    numbers.push({ phone, label });
  }
  return { numbers, invalid, repeated };
}

/** Volta para o texto do campo, uma linha por número. */
export function formatInternalNumberLines(numbers: readonly InternalNumber[]) {
  return numbers.map((item) => `${formatInternalPhone(item.phone)}${item.label ? ` ${item.label}` : ""}`).join("\n");
}

export function formatInternalPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

/** Só os 4 últimos dígitos, para mostrar destino sem expor o número inteiro. */
export function lastFourDigits(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `final ${digits.slice(-4)}` : "sem número";
}

export function buildInternalDirectory(input: {
  team: ReadonlyArray<{ phone: string | null; name: string }>;
  list: readonly InternalNumber[];
}): InternalDirectory {
  const team = new Map<string, string>();
  for (const member of input.team) {
    const key = internalPhoneKey(member.phone);
    if (key && !team.has(key)) team.set(key, member.name);
  }
  const list = new Map<string, string>();
  for (const item of input.list) {
    const key = internalPhoneKey(item.phone);
    if (key && !list.has(key)) list.set(key, item.label);
  }
  return { team, list };
}

/** É interno? A equipe vem antes da lista: o motivo registrado diz de onde veio. */
export function classifyInternalContact(phone: string | null | undefined, directory: InternalDirectory): InternalDecision {
  const key = internalPhoneKey(phone);
  if (!key) return { internal: false };
  const member = directory.team.get(key);
  if (member !== undefined) return { internal: true, reason: "team_member", label: member };
  const listed = directory.list.get(key);
  if (listed !== undefined) return { internal: true, reason: "internal_list", label: listed };
  return { internal: false };
}

/** Código curto gravado no evento do webhook, para saber por que a mensagem não virou lead. */
export function internalContactCode(decision: Extract<InternalDecision, { internal: true }>) {
  return decision.reason === "team_member" ? "internal_contact_team" : "internal_contact_list";
}
