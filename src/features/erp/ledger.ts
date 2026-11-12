import { ErpError, MAX_CENTS } from "./contracts";

export type LedgerMovement = { kind: string; status: string; amountCents: number };
export function checkedCents(value: string | number | bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new ErpError("O total excede o limite seguro de conferência.");
  return result;
}
export function settledCents(movements: readonly LedgerMovement[]) {
  return checkedCents(movements.reduce((total, row) => total + (row.status === "confirmed" ? BigInt(row.amountCents) * BigInt(row.kind === "reversal" ? -1 : 1) : BigInt(0)), BigInt(0)));
}
export function assertPaymentCapacity(amountCents: number, confirmed: number, reserved: number, requested: number) {
  if (![amountCents, confirmed, reserved, requested].every(Number.isSafeInteger) || requested <= 0 || requested > MAX_CENTS || confirmed < 0 || reserved < 0 || BigInt(confirmed) + BigInt(reserved) + BigInt(requested) > BigInt(amountCents)) throw new ErpError("O valor excede o saldo disponível, incluindo liquidações aguardando revisão.");
}
export function requireSameRequest(existing: { requestId: string }, expected: string) {
  if (existing.requestId !== expected) throw new ErpError("A referência já está em uso. Confira o lançamento existente.");
}
export function assertOccurredByToday(value: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(now);
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === key)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  if (value > today) throw new ErpError("A data efetiva não pode estar no futuro. Para previsão, informe o vencimento do lançamento.");
}
