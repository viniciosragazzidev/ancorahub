import type { SaleContractReading, SalePlanType } from "./conversation-sale-core";

const TYPES: SalePlanType[] = ["individual", "familiar", "pme", "empresarial"];

/** O JSON que a IA devolveu (às vezes dentro de ```json) → leitura validada. null quando não há JSON. */
export function parseContractReading(text: string): SaleContractReading | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null);
  const planType = typeof raw.planType === "string" && (TYPES as string[]).includes(raw.planType) ? (raw.planType as SalePlanType) : null;
  const ages = Array.isArray(raw.ages)
    ? raw.ages.map((age) => (typeof age === "string" ? Number(age) : age)).filter((age): age is number => typeof age === "number" && Number.isInteger(age) && age >= 0 && age <= 120).slice(0, 30)
    : null;
  const value = typeof raw.monthlyValue === "string" ? Number(raw.monthlyValue.replace(/\./g, "").replace(",", ".")) : raw.monthlyValue;
  const monthlyValue = typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000 ? value : null;
  const date = str(raw.coverageStartDate);
  return {
    planType,
    ages: ages?.length ? ages : null,
    carrierName: str(raw.carrierName),
    planName: str(raw.planName),
    monthlyValue,
    coverageStartDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}
