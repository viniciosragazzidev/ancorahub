// ─── Normalização (acentos, busca) ────────────────────────────────────────────

/** Remove acentos e normaliza para minúsculo (busca accent-insensitive) */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

// ─── Mascaramento de dados pessoais ────────────────────────────────────────────

/** Oculta telefone, mantendo apenas os 4 últimos dígitos */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4
    ? `${String("•").repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
    : "••••";
}

/** Oculta parte do nome, mantendo apenas o primeiro nome visível */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  const first = parts[0];
  if (parts.length === 1) {
    return first.slice(0, Math.ceil(first.length / 2)) + "*".repeat(Math.floor(first.length / 2));
  }
  return `${first} ${"*".repeat(Math.max(1, name.length - first.length - 1))}`;
}

// ─── Formatação de datas ───────────────────────────────────────────────────────

/** Formata data no locale pt-BR com proteção contra null/inválido */
export function formatDate(
  value: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

// ─── Formatação compacta de valores ────────────────────────────────────────────

export function formatCurrencyCompact(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "R$ 0";
  if (num >= 1_000_000) return `R$ ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `R$ ${(num / 1_000).toFixed(1)}K`;
  return formatCurrency(value);
}

export function formatCurrency(
  value: string | number,
  options?: Intl.NumberFormatOptions,
): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) {
    // Se pediu sem decimais, retorna sem decimais
    if (options?.maximumFractionDigits === 0) return "R$ 0";
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    ...options,
  }).format(num);
}


export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${formatPhoneForWhatsApp(phone)}?text=${encoded}`;
}

export function buildQuoteSummary(quote: {
  leadName: string;
  totalMonthly?: number | null;
  beneficiaryCount?: number | null;
  publicToken: string;
}): string {
  const lines = [
    `Proposta para ${quote.leadName}`,
    "",
  ];

  if (quote.beneficiaryCount) {
    lines.push(`${quote.beneficiaryCount} beneficiário(s)`);
  }

  if (quote.totalMonthly) {
    lines.push(`Valor mensal: ${formatCurrency(quote.totalMonthly)}`);
  }

  lines.push("");
  lines.push(`Veja a proposta completa:`);

  return lines.join("\n");
}

export function buildQuoteWhatsAppMessage(quote: {
  leadName: string;
  totalMonthly?: number | null;
  beneficiaryCount?: number | null;
  publicToken: string;
  baseUrl?: string;
}): string {
  const baseUrl = quote.baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  const proposalUrl = `${baseUrl}/cotacao/${quote.publicToken}`;

  const lines = [
    `Olá ${quote.leadName}!`,
    "",
    `Preparamos uma proposta personalizada para você.`,
  ];

  if (quote.beneficiaryCount) {
    lines.push(`Beneficiários: ${quote.beneficiaryCount}`);
  }

  if (quote.totalMonthly) {
    lines.push(`Valor mensal: ${formatCurrency(quote.totalMonthly)}`);
  }

  lines.push("");
  lines.push(`Acesse aqui para ver todos os detalhes:`);
  lines.push(proposalUrl);

  return lines.join("\n");
}
