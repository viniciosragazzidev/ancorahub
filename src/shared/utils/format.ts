/**
 * Utilitários de formatação automática para campos de formulário.
 *
 * Todas as funções são puras e funcionam tanto no cliente quanto no servidor.
 *
 * Uso no servidor:
 *   import { unformat } from "@/shared/utils/format";
 *   const cnpj = unformat(formData.get("cnpj"));
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remove tudo que não é dígito */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

import { normalize } from "@/features/quotes/utils";

// ─── Formatos ────────────────────────────────────────────────────────────────

export type FormatType =
  | "cnpj"
  | "cpf"
  | "phone"
  | "cep"
  | "rg"
  | "currency"
  | "ie"
  | "date"
  | "placa"
  | "cns"
  | "none";

/** CNPJ: XX.XXX.XXX/XXXX-XX */
export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** CPF: XXX.XXX.XXX-XX */
export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/**
 * Telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * Detecta automaticamente se é celular (11 dígitos) ou fixo (10 dígitos).
 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.replace(/^(\d{0,2})/, digits.length > 0 ? "($1" : "$1");
  if (digits.length <= 7) {
    // (XX) XXXX
    return digits.replace(/^(\d{2})(\d{1,5})/, "($1) $2");
  }
  if (digits.length <= 10) {
    // (XX) XXXX-XXXX (fixo)
    return digits.replace(/^(\d{2})(\d{4})(\d{1,4})/, "($1) $2-$3");
  }
  // (XX) XXXXX-XXXX (celular)
  return digits.replace(/^(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
}

/** CEP: XXXXX-XXX */
export function formatCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

/** RG: XX.XXX.XXX-X */
export function formatRG(value: string): string {
  const digits = onlyDigits(value).slice(0, 9);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/**
 * Moeda: R$ 1.234,56
 * Aceita digitação progressiva: conforme o usuário digita números,
 * o valor é formatado como moeda brasileira.
 */
export function formatCurrency(value: string): string {
  // Remove tudo que não é dígito (para reconstruir do zero)
  const digits = value.replace(/\D/g, "");
  if (!digits.length) return "";

  // Converte para centavos: "1500" → 15.00
  const asNumber = parseInt(digits, 10) / 100;
  if (isNaN(asNumber)) return "";

  return asNumber.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Inscrição Estadual: XXX.XXX.XXX.XXX (formato genérico) */
export function formatIE(value: string): string {
  const digits = onlyDigits(value).slice(0, 12);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1.$2");
}

/**
 * Data: DD/MM/AAAA
 * Formata progressivamente enquanto o usuário digita.
 */
export function formatDateBR(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
}

/** CNS / Cartão SUS: XXX XXXX XXXX XXXX */
export function formatCNS(value: string): string {
  const digits = onlyDigits(value).slice(0, 15);
  return digits
    .replace(/^(\d{3})(\d)/, "$1 $2")
    .replace(/^(\d{3}) (\d{4})(\d)/, "$1 $2 $3")
    .replace(/^(\d{3}) (\d{4}) (\d{4})(\d)/, "$1 $2 $3 $4");
}

/** Placa: XXX-XXXX */
export function formatPlaca(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  return cleaned.replace(/^([A-Z]{3})(\d)/, "$1-$2");
}

// ─── Aplicador universal ─────────────────────────────────────────────────────

/** Aplica a formatação correspondente ao tipo detectado */
export function applyFormat(value: string, type: FormatType): string {
  if (!value) return value;
  switch (type) {
    case "cnpj": return formatCNPJ(value);
    case "cpf": return formatCPF(value);
    case "phone": return formatPhone(value);
    case "cep": return formatCEP(value);
    case "rg": return formatRG(value);
    case "currency": return formatCurrency(value);
    case "ie": return formatIE(value);
    case "date": return formatDateBR(value);
    case "cns": return formatCNS(value);
    case "placa": return formatPlaca(value);
    default: return value;
  }
}

// ─── Limpeza para envio ao servidor ──────────────────────────────────────────

/** Remove toda formatação (mantém apenas dígitos) */
export function unformat(value: string): string {
  return value.replace(/\D/g, "");
}

/** Converte moeda formatada ("R$ 1.234,56") para número (1234.56) */
export function unformatCurrency(value: string): number {
  const cleaned = value
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// ─── Helper para Server Actions ───────────────────────────────────────────────

/**
 * Modo de limpeza aplicado a um campo do formulário.
 * - `"digits"`: remove tudo que não é dígito (CNPJ, CPF, telefone, CEP, RG, IE)
 * - `"currency"`: converte "R$ 1.234,56" para número (1234.56)
 * - `"string"`: retorna o valor sem modificação
 */
export type CleanMode = "digits" | "currency" | "string";

/**
 * Limpa campos de um FormData para Server Actions.
 *
 * Remove automaticamente a formatação visual (máscara) que foi aplicada
 * pelo componente `Input` no cliente, devolvendo valores limpos.
 *
 * @example
 * ```ts
 * "use server"
 * import { cleanFormData } from "@/shared/utils/format";
 *
 * export async function createTenantAction(formData: FormData) {
 *   const { cnpj, phone, name } = cleanFormData(formData, {
 *     cnpj: "digits",
 *     phone: "digits",
 *     name: "string",
 *   });
 *   // cnpj = "41817056000170" (limpo)
 *   // phone = "11999999999"   (limpo)
 *   // name = "Empresa XYZ"    (original)
 * }
 * ```
 *
 * @example
 * ```ts
 * // Forma abreviada: todos os campos listados são tratados como "digits"
 * const { cnpj, telefone } = cleanFormData(formData, ["cnpj", "telefone"]);
 * ```
 */
export function cleanFormData<T extends Record<string, CleanMode>>(
  formData: FormData,
  fields: T,
): { [K in keyof T]: T[K] extends "currency" ? number : string };

export function cleanFormData<K extends string>(
  formData: FormData,
  fields: K[],
): { [P in K]: string };

export function cleanFormData(
  formData: FormData,
  fields: Record<string, CleanMode> | string[],
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  if (Array.isArray(fields)) {
    // Modo array: todos os campos são "digits"
    for (const key of fields) {
      result[key] = onlyDigits(String(formData.get(key) ?? ""));
    }
  } else {
    // Modo objeto: cada campo tem seu próprio modo
    for (const [key, mode] of Object.entries(fields)) {
      const raw = String(formData.get(key) ?? "");
      switch (mode) {
        case "digits":
          result[key] = onlyDigits(raw);
          break;
        case "currency":
          result[key] = unformatCurrency(raw);
          break;
        case "string":
        default:
          result[key] = raw;
          break;
      }
    }
  }

  return result;
}

// ─── Detecção automática de formato pelo id/name ─────────────────────────────

const FORMAT_DETECTORS: { pattern: RegExp; type: FormatType }[] = [
  { pattern: /cnpj/i, type: "cnpj" },
  { pattern: /cpf/i, type: "cpf" },
  { pattern: /telefone|phone|celular|whatsapp/i, type: "phone" },
  { pattern: /cep/i, type: "cep" },
  { pattern: /rg$|identidade|documento/i, type: "rg" },
  { pattern: /valor|preco|price|comissao|comission|monthlyprice|monthly_price|mensalidade/i, type: "currency" },
  { pattern: /inscricao_estadual|ie$/i, type: "ie" },
  { pattern: /data$|date|nascimento|validade|vencimento/i, type: "date" },
  { pattern: /cns|sus|cartaos?us/i, type: "cns" },
  { pattern: /placa/i, type: "placa" },
];

/**
 * Detecta automaticamente o formato de um campo baseado no seu `id` ou `name`.
 *
 * Exemplo:
 *   detectFormat("lead-phone")      → "phone"
 *   detectFormat("cnpj")            → "cnpj"
 *   detectFormat("team-name")       → "none"
 */
export function detectFormat(id?: string, name?: string): FormatType {
  const source = [id, name].filter(Boolean).join(" ");
  if (!source) return "none";

  const normalized = normalize(source);
  for (const detector of FORMAT_DETECTORS) {
    if (detector.pattern.test(normalized)) return detector.type;
  }
  return "none";
}
