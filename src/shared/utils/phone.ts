/**
 * Utilitários consolidados para manipulação de telefones.
 */

// ─── Limpeza de dígitos ─────────────────────────────────────────────────────

/**
 * Remove todos os caracteres não numéricos de uma string.
 * Seguro contra valores nulos/indefinidos.
 *
 * @example cleanDigits("(71) 99999-1234") → "71999991234"
 */
export function cleanDigits(value?: string | null): string {
  if (!value || typeof value !== "string") return "";
  return value.replace(/\D/g, "");
}

// ─── Normalização ────────────────────────────────────────────────────────────

/**
 * Normaliza telefone removendo formatação, mantendo apenas dígitos.
 * Não adiciona nenhum prefixo — use esta função para comparações e buscas.
 *
 * @example normalizePhone("+55 71 99999-1234") → "5571999991234"
 */
export function normalizePhone(value?: string | null): string {
  return cleanDigits(value);
}

/**
 * Normaliza telefone garantindo prefixo brasileiro "55".
 * Remove todos os caracteres não numéricos e prefixa "55" se ausente.
 *
 * @example ensureBrazilPhone("71 99999-1234") → "5571999991234"
 * @example ensureBrazilPhone("5571999991234") → "5571999991234"
 */
export function ensureBrazilPhone(value?: string | null): string {
  const digits = cleanDigits(value);
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Alias para ensureBrazilPhone — mantém compatibilidade com o nome original.
 */
export function formatPhoneForWhatsApp(phone?: string | null): string {
  return ensureBrazilPhone(phone);
}

// ─── Mascaramento ────────────────────────────────────────────────────────────

/**
 * Mascara telefone para exibição, ocultando dígitos intermediários.
 * Formato: +55 XX 9****-XXXX
 */
export function maskPhone(value?: string | null): string {
  const digits = cleanDigits(value);
  if (digits.length < 8) return "••••";
  const start = digits.slice(0, Math.max(2, digits.length > 12 ? 4 : 2));
  return `+${start} ${digits.slice(start.length, start.length + 2)} 9****-${digits.slice(-4)}`;
}

// ─── Construção de links ─────────────────────────────────────────────────────

/**
 * Constrói link direto para WhatsApp com mensagem pré-preenchida.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${ensureBrazilPhone(phone)}?text=${encoded}`;
}
