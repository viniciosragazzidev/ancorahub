import { z } from "zod";
import { checkedCents } from "./ledger";

/** Shared ERP primitives. Do not redefine these per service. */
export const ERP_TIME_ZONE = "America/Sao_Paulo";
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe a competência no formato AAAA-MM.");
export const uuidSchema = z.string().uuid();
export const reasonSchema = z.string().trim().min(5, "Informe o motivo ou parecer com pelo menos 5 caracteres.").max(300, "Use até 300 caracteres.");
export const PAGE_SIZE = 25;
export const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);

/** Calendar date (AAAA-MM-DD) in São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ERP_TIME_ZONE }).formatToParts(now);
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function currentPeriod(now: Date = new Date()) { return todayInSaoPaulo(now).slice(0, 7); }
/** [first day, first day of next month) of a competence, for sargable date filters. */
export function periodBounds(period: string) {
  const value = periodSchema.parse(period); const [year, month] = value.split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return { start: `${value}-01`, end: `${next}-01` };
}

/** Sum of pending (unreviewed) amounts of a given movement kind. */
export function pendingCents(rows: readonly { status: string; kind: string; amountCents: number }[], kind: string) {
  return checkedCents(rows.filter((row) => row.status === "pending" && row.kind === kind).reduce((sum, row) => sum + BigInt(row.amountCents), BigInt(0)));
}

export const PAYOUT_STATUSES = ["prepared", "approved", "paying", "settled", "cancelled"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
export const OPEN_PAYOUT_STATUSES: readonly PayoutStatus[] = ["prepared", "approved", "paying"];
export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = { prepared: "Aguardando aprovação", approved: "Aprovado para pagamento", paying: "Pagamento a conferir", settled: "Liquidado", cancelled: "Cancelado" };
export const ENTRY_STATUSES = ["submitted", "approved", "rejected"] as const;
export const ENTRY_STATUS_LABELS: Record<(typeof ENTRY_STATUSES)[number], string> = { submitted: "Aguardando aprovação", approved: "Aprovado", rejected: "Rejeitado" };
export const MOVEMENT_STATUS_LABELS: Record<string, string> = { pending: "A conferir", confirmed: "Confirmado", rejected: "Rejeitado" };
export const STALE_VERSION_MESSAGE = "Este registro mudou. Atualize a página e confira novamente.";
