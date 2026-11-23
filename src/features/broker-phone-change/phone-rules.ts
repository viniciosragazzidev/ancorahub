/**
 * Regras do celular que o corretor grava como próprio (23/11/2026). Puras, para o cliente e o servidor.
 *
 * O número fica em broker_profiles.phone só com dígitos, com 55 e DDD ("5571999991234"). As buscas do
 * sistema (notificações, recuperação de senha, OpenWA, WAHA, plantão) limpam os dígitos e comparam pelo
 * final, então esse formato serve a todas. Cadastros antigos podem estar sem o 55 ou sem o 9: a checagem de
 * duplicado compara essas variações também.
 */

/** DDDs em uso no Brasil (Anatel). */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type BrazilMobileResult =
  | { ok: true; phone: string; national: string }
  | { ok: false; error: string };

const digitsOf = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/** Os 11 dígitos nacionais (DDD + 9 + 8), ou null se não der para tirar isso do que foi digitado. */
function nationalDigits(digits: string) {
  let rest = digits;
  if (rest.length === 13 && rest.startsWith("55")) rest = rest.slice(2);
  else if (rest.length === 12 && rest.startsWith("0")) rest = rest.slice(1);
  return rest;
}

/** Valida um celular brasileiro e devolve no formato gravado: 55 + DDD + 9 dígitos. */
export function parseBrazilMobile(raw: unknown): BrazilMobileResult {
  const digits = digitsOf(typeof raw === "string" ? raw : "");
  if (!digits) return { ok: false, error: "Digite o novo celular com DDD." };
  const national = nationalDigits(digits);
  if (national.length !== 11) return { ok: false, error: "O celular precisa ter DDD e 9 dígitos, como (71) 99999-1234." };
  if (!DDDS.has(Number(national.slice(0, 2)))) return { ok: false, error: "Esse DDD não existe. Confira os dois primeiros números." };
  if (national[2] !== "9") return { ok: false, error: "O celular começa com 9 depois do DDD." };
  return { ok: true, phone: `55${national}`, national };
}

/**
 * As formas em que o mesmo celular pode estar gravado: com ou sem 55, com ou sem o 9.
 * Recebe os 11 dígitos nacionais.
 */
export function brazilMobileVariants(national: string): string[] {
  const ddd = national.slice(0, 2);
  const withoutNine = `${ddd}${national.slice(3)}`;
  return [`55${national}`, national, `55${withoutNine}`, withoutNine];
}

/** O número gravado é o mesmo celular, mesmo num formato antigo? */
export function isSameMobile(stored: string | null | undefined, national: string) {
  const digits = digitsOf(stored);
  return Boolean(digits) && brazilMobileVariants(national).includes(digits);
}

/** "5571999991234" vira "(71) 99999-1234"; o que não for celular brasileiro fica como veio. */
export function formatBrazilMobile(stored: string | null | undefined) {
  const parsed = parseBrazilMobile(stored ?? "");
  if (!parsed.ok) return stored ?? "";
  const n = parsed.national;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

/** Máscara enquanto digita: "(71) 99999-1234". Aceita colar com +55. */
export function maskBrazilMobileInput(value: string) {
  let digits = digitsOf(value);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
