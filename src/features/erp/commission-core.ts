import { createHash } from "node:crypto";
import { ErpError, MAX_CENTS } from "./contracts";

/** Postgres numeric(12,2) text → integer cents, without floating point. */
export function numericToCents(raw: string | number | null | undefined): number {
  const value = String(raw ?? "").trim();
  const match = /^(-)?(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new ErpError("Valor do cronograma ilegível. Confira a venda.");
  const cents = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"));
  const result = Number(match[1] ? -cents : cents);
  if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_CENTS) throw new ErpError("Valor do cronograma fora do limite.");
  return result;
}

/** Stable RFC 4122 v5-shaped id: the same origin always maps to the same request. */
export function deterministicUuid(seed: string): string {
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Due date of a legacy installment as a São Paulo calendar date, falling back to the 10th of the reference month. */
export function scheduleDueOn(dueDate: Date | null, referenceMonth: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) throw new ErpError("Competência do cronograma inválida.");
  if (!dueDate) return `${referenceMonth}-10`;
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(dueDate);
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export type LegacyDivergence = "legacy_cancelled" | "legacy_chargeback" | "legacy_paid_not_settled" | "settled_legacy_pending" | null;
/** Compares the legacy schedule status with the ERP fact; the ERP never silently follows the legacy screen. */
export function legacyDivergence(legacyStatus: string, entry: { status: string; amountCents: number; settledCents: number } | null): LegacyDivergence {
  if (!entry || entry.status === "rejected") return null;
  if (legacyStatus === "cancelled") return "legacy_cancelled";
  if (legacyStatus === "chargeback_pending") return "legacy_chargeback";
  if (legacyStatus === "paid" && entry.settledCents < entry.amountCents) return "legacy_paid_not_settled";
  if (legacyStatus === "pending" && entry.settledCents >= entry.amountCents) return "settled_legacy_pending";
  return null;
}
export const DIVERGENCE_LABELS: Record<Exclude<LegacyDivergence, null>, string> = {
  legacy_cancelled: "Cronograma cancelado após a conferência",
  legacy_chargeback: "Cronograma em revisão de estorno (chargeback)",
  legacy_paid_not_settled: "Marcado como pago fora do ERP, sem liquidação conferida",
  settled_legacy_pending: "Liquidado no ERP e pendente no cronograma",
};
