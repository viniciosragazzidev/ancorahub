/**
 * Linha digitável de boleto: leitura, dígitos verificadores, valor e vencimento.
 * Boleto bancário tem 47 dígitos; boleto de arrecadação (começa com 8) tem 48.
 */

export type ParsedLinhaDigitavel = {
  kind: "bancario" | "arrecadacao";
  digits: string;
  valid: boolean;
  /** Valor embutido na linha, em reais. Null quando a linha não traz valor. */
  amount: number | null;
  /** Vencimento embutido (yyyy-mm-dd). Só existe no boleto bancário com fator diferente de zero. */
  dueDate: string | null;
  bankCode: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fator 0 do vencimento. Em 22/02/2025 o fator chegou a 9999 e recomeçou em 1000. */
const FATOR_BASE = Date.UTC(1997, 9, 7);
const FATOR_RESTART_OFFSET = 9000;

export function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function mod10(numbers: string) {
  let sum = 0;
  let weight = 2;
  for (let index = numbers.length - 1; index >= 0; index -= 1) {
    let product = Number(numbers[index]) * weight;
    if (product > 9) product = Math.floor(product / 10) + (product % 10);
    sum += product;
    weight = weight === 2 ? 1 : 2;
  }
  return (10 - (sum % 10)) % 10;
}

/** Módulo 11 do código de barras bancário (pesos 2 a 9). Resultados 0, 10 e 11 viram 1. */
export function mod11Bancario(numbers: string) {
  let sum = 0;
  let weight = 2;
  for (let index = numbers.length - 1; index >= 0; index -= 1) {
    sum += Number(numbers[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** Módulo 11 da arrecadação: resto 0 ou 1 vira 0, resto 10 vira 1. */
function mod11Arrecadacao(numbers: string) {
  let sum = 0;
  let weight = 2;
  for (let index = numbers.length - 1; index >= 0; index -= 1) {
    sum += Number(numbers[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  if (rest === 0 || rest === 1) return 0;
  if (rest === 10) return 1;
  return 11 - rest;
}

function toIsoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Converte o fator de vencimento em data. Como o fator recomeçou em 2025,
 * o mesmo fator vale para duas datas: fica a mais próxima da data de referência.
 */
export function dueDateFromFator(fator: number, reference: Date = new Date()) {
  if (!fator) return null;
  const first = FATOR_BASE + fator * DAY_MS;
  const second = FATOR_BASE + (fator + FATOR_RESTART_OFFSET) * DAY_MS;
  const ref = reference.getTime();
  return toIsoDate(Math.abs(first - ref) <= Math.abs(second - ref) ? first : second);
}

function parseBancario(digits: string, reference: Date): ParsedLinhaDigitavel {
  const field1 = digits.slice(0, 9);
  const field2 = digits.slice(10, 20);
  const field3 = digits.slice(21, 31);
  const generalDv = digits[32];
  const fator = digits.slice(33, 37);
  const valor = digits.slice(37, 47);

  const fieldsOk =
    mod10(field1) === Number(digits[9]) &&
    mod10(field2) === Number(digits[20]) &&
    mod10(field3) === Number(digits[31]);
  const barcodeWithoutDv = digits.slice(0, 4) + fator + valor + digits.slice(4, 9) + field2 + field3;
  const generalOk = mod11Bancario(barcodeWithoutDv) === Number(generalDv);
  const cents = Number(valor);

  return {
    kind: "bancario",
    digits,
    valid: fieldsOk && generalOk,
    amount: cents > 0 ? cents / 100 : null,
    dueDate: dueDateFromFator(Number(fator), reference),
    bankCode: digits.slice(0, 3),
  };
}

function parseArrecadacao(digits: string): ParsedLinhaDigitavel {
  const blocks = [0, 1, 2, 3].map((index) => digits.slice(index * 12, index * 12 + 12));
  const valueIndicator = digits[2];
  const useMod10 = valueIndicator === "6" || valueIndicator === "7";
  const check = useMod10 ? mod10 : mod11Arrecadacao;
  const blocksOk = blocks.every((block) => check(block.slice(0, 11)) === Number(block[11]));
  const barcode = blocks.map((block) => block.slice(0, 11)).join("");
  const generalOk = check(barcode.slice(0, 3) + barcode.slice(4)) === Number(barcode[3]);
  const hasRealValue = valueIndicator === "6" || valueIndicator === "8";
  const cents = Number(barcode.slice(4, 15));

  return {
    kind: "arrecadacao",
    digits,
    valid: blocksOk && generalOk,
    amount: hasRealValue && cents > 0 ? cents / 100 : null,
    dueDate: null,
    bankCode: null,
  };
}

export function parseLinhaDigitavel(value: string | null | undefined, reference: Date = new Date()) {
  const digits = onlyDigits(value);
  if (digits.length === 47) return parseBancario(digits, reference);
  if (digits.length === 48 && digits.startsWith("8")) return parseArrecadacao(digits);
  return null;
}

/**
 * Procura linhas digitáveis num texto livre (PDF ou transcrição de imagem).
 * As válidas vêm primeiro.
 */
export function findLinhasDigitaveis(text: string, reference: Date = new Date()) {
  const found = new Map<string, ParsedLinhaDigitavel>();
  for (const match of text.matchAll(/\d[\d.\s-]{40,70}\d/g)) {
    const digits = onlyDigits(match[0]);
    const candidates = digits.length === 47 || digits.length === 48 ? [digits] : [];
    // Uma sequência maior pode juntar a linha com números vizinhos: testa janelas de 47.
    if (digits.length > 48) {
      for (let start = 0; start + 47 <= digits.length; start += 1) candidates.push(digits.slice(start, start + 47));
    }
    for (const candidate of candidates) {
      const parsed = parseLinhaDigitavel(candidate, reference);
      if (parsed && (parsed.valid || candidates.length === 1)) found.set(parsed.digits, parsed);
    }
  }
  return [...found.values()].sort((a, b) => Number(b.valid) - Number(a.valid));
}
