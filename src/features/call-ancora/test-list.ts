/** "Lista de teste (ligação real)": números digitados por admin/dev para testar o app Android. */

export const CALL_ANCORA_TEST_LIST_MAX = 50;

export type CallAncoraTestEntry = { name: string; phone: string };
export type CallAncoraTestListResult = { entries: CallAncoraTestEntry[]; errors: string[] };

/**
 * Normaliza um telefone brasileiro para +55DDNNNNNNNN(N).
 * Aceita com ou sem +55, com máscara. Celular precisa começar com 9.
 */
export function normalizeBrPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return null;
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = digits.slice(0, 2);
  if (!/^[1-9][1-9]$/.test(ddd)) return null;
  const local = digits.slice(2);
  if (digits.length === 11 && !local.startsWith("9")) return null;
  if (digits.length === 10 && !/^[2-5]/.test(local)) return null;
  return `+55${digits}`;
}

/** (21) 99999-0000 a partir de +5521999990000. */
export function formatBrPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "").replace(/^55/, "");
  const ddd = digits.slice(0, 2);
  const local = digits.slice(2);
  const split = local.length === 9 ? 5 : 4;
  return `(${ddd}) ${local.slice(0, split)}-${local.slice(split)}`;
}

/**
 * Uma linha por número. Nome opcional, separado por ; , | ou tab, antes ou depois do número.
 * Ex.: "21999990000", "Ana; (21) 99999-0000", "(21) 98888-7777 | Bruno".
 */
export function parseCallAncoraTestList(text: string): CallAncoraTestListResult {
  const entries: CallAncoraTestEntry[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const parts = line.split(/[;,|\t]/).map((part) => part.trim()).filter(Boolean);
    let phone: string | null = null;
    let name = "";
    for (const part of parts) {
      const normalized: string | null = phone ? null : normalizeBrPhone(part);
      if (normalized) phone = normalized;
      else name = name ? `${name} ${part}` : part;
    }
    if (!phone) {
      errors.push(`Linha ${index + 1}: número inválido.`);
      return;
    }
    if (seen.has(phone)) return;
    seen.add(phone);
    entries.push({ name: name.slice(0, 60) || `Contato de teste ${entries.length + 1}`, phone });
  });

  if (entries.length > CALL_ANCORA_TEST_LIST_MAX) {
    errors.push(`No máximo ${CALL_ANCORA_TEST_LIST_MAX} números por lista.`);
  }
  return { entries, errors };
}

/** Mostra só os 2 últimos dígitos. */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `•••• ••${digits.slice(-2)}`;
}
