/**
 * Utilitários consolidados para manipulação de telefones.
 *
 * Substitui as duplicações em:
 * - features/waha-cadence/contract.ts (normalizePhone)
 * - features/browser-extension/schemas.ts (normalizePhone, maskPhone)
 * - app/(dashboard)/conversas/page.tsx (normalizePhone, maskPhone)
 * - features/communication-channels/service.ts (normalizePhone)
 * - features/leads/bulk-import.ts (normalizePhone)
 * - features/lead-distribution/offers.ts (normalizePhone)
 * - features/leads/manual-create.ts (normalizePhone)
 * - features/marketing-import/service.ts (normalizePhone)
 * - features/quotes/utils.ts (maskPhone, formatPhoneForWhatsApp)
 * - features/ai-qualification/whatsapp-diagnostic-service.ts (maskPhoneNumber)
 */

// ─── Limpeza de dígitos ─────────────────────────────────────────────────────

/**
 * Remove todos os caracteres não numéricos de uma string.
 * Equivalente ao antigo `phone.replace(/\D/g, "")` espalhado por 20+ arquivos.
 *
 * @example cleanDigits("(71) 99999-1234") → "71999991234"
 */
export function cleanDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// ─── Normalização ────────────────────────────────────────────────────────────

/**
 * Normaliza telefone removendo formatação, mantendo apenas dígitos.
 * Não adiciona nenhum prefixo — use esta função para comparações e buscas.
 *
 * Substitui: normalizePhone em communication-channels/service,
 * lead-distribution/offers, waha-cadence/contract, conversas/page, etc.
 *
 * @example normalizePhone("+55 71 99999-1234") → "5571999991234"
 */
export function normalizePhone(value: string): string {
  return cleanDigits(value);
}

/**
 * Normaliza telefone garantindo prefixo brasileiro "55".
 * Remove todos os caracteres não numéricos e prefixa "55" se ausente.
 *
 * Substitui: normalizePhone em leads/bulk-import, leads/manual-create,
 * marketing-import/service, quotes/utils (formatPhoneForWhatsApp).
 *
 * @example ensureBrazilPhone("71 99999-1234") → "5571999991234"
 * @example ensureBrazilPhone("5571999991234") → "5571999991234"
 */
export function ensureBrazilPhone(value: string): string {
  const digits = cleanDigits(value);
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Alias para ensureBrazilPhone — mantém compatibilidade com o nome original.
 * Substitui: formatPhoneForWhatsApp em features/quotes/utils.ts
 */
export function formatPhoneForWhatsApp(phone: string): string {
  return ensureBrazilPhone(phone);
}

// ─── Mascaramento ────────────────────────────────────────────────────────────

/**
 * Mascara telefone para exibição, ocultando dígitos intermediários.
 * Formato: +55 XX 9****-XXXX
 *
 * Substitui: maskPhone em browser-extension/schemas, quotes/utils, conversas/page
 * Substitui: maskPhoneNumber em ai-qualification/whatsapp-diagnostic-service
 */
export function maskPhone(value: string): string {
  const digits = cleanDigits(value);
  if (digits.length < 8) return "••••";
  const start = digits.slice(0, Math.max(2, digits.length > 12 ? 4 : 2));
  return `+${start} ${digits.slice(start.length, start.length + 2)} 9****-${digits.slice(-4)}`;
}

// ─── Construção de links ─────────────────────────────────────────────────────

/**
 * Constrói link direto para WhatsApp com mensagem pré-preenchida.
 * Substitui: buildWhatsAppLink em features/quotes/utils.ts
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${ensureBrazilPhone(phone)}?text=${encoded}`;
}
