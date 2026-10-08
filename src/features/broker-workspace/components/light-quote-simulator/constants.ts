import {
  MOCK_PLANS,
  type Accommodation,
  type Copayment,
  type Coverage,
  type MockPlan,
  type ProfileType,
  type Region,
} from "@/features/broker-workspace/quote-simulator/mock-data";
import type { BeneficiaryInput } from "@/features/broker-workspace/quote-simulator/pricing";

/** The flow has four steps: profile and lives, preferences, plans (with comparison) and summary. */
export type Step = 0 | 1 | 2 | 3;
export type Beneficiary = { id: string; age: string };
export type SortMode = "price" | "network" | "per-life";
export type PlansView = "list" | "compare";

export const STEPS = [
  { id: "profile", label: "Perfil" },
  { id: "preferences", label: "Preferências" },
  { id: "plans", label: "Planos" },
  { id: "summary", label: "Resumo" },
];

export const MAX_LIVES = 29;
export const MAX_COMPARED = 3;
export const BUDGET_MIN = 300;
export const BUDGET_MAX = 6000;

export const PROFILE_OPTIONS = [
  { value: "individual", label: "Pessoa física" },
  { value: "family", label: "Familiar" },
  { value: "pme", label: "PME, de 2 a 29 vidas" },
  { value: "adhesion", label: "Adesão" },
];

export const SORT_OPTIONS = [
  { value: "price", label: "Menor preço" },
  { value: "network", label: "Melhor rede" },
  { value: "per-life", label: "Por vida" },
];

export const CARRIERS = Array.from(new Set(MOCK_PLANS.map((plan) => plan.carrier)));

export const REGION_LABEL: Record<Region, string> = {
  "rj-capital": "Rio de Janeiro, capital",
  baixada: "Baixada Fluminense",
  "niteroi-sg": "Niterói e São Gonçalo",
  "sp-capital": "São Paulo, capital",
  other: "Outra região",
};
export const ACCOMMODATION_LABEL: Record<Accommodation, string> = { ward: "Enfermaria", private: "Apartamento" };
export const COPAYMENT_LABEL: Record<Copayment, string> = { none: "Sem coparticipação", partial: "Parcial", full: "Total" };
export const COVERAGE_LABEL: Record<Coverage, string> = { regional: "Regional", state: "Estadual", national: "Nacional" };
export const PROFILE_LABEL: Record<ProfileType, string> = {
  individual: "Pessoa física",
  family: "Familiar",
  pme: "PME",
  adhesion: "Adesão",
};

export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function percent(value: number) {
  return value.toFixed(1).replace(".", ",");
}

export function makeBeneficiary(): Beneficiary {
  return { id: "life-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), age: "" };
}

export function getNetworkMatch(plan: MockPlan, selectedHospitals: readonly string[]) {
  return selectedHospitals.filter((hospital) => plan.hospitals.includes(hospital)).length;
}

export function ageInputs(beneficiaries: Beneficiary[]): BeneficiaryInput[] | null {
  const parsed: BeneficiaryInput[] = [];
  for (const beneficiary of beneficiaries) {
    if (!/^\d{1,3}$/.test(beneficiary.age)) return null;
    const age = Number(beneficiary.age);
    if (age < 0 || age > 120) return null;
    parsed.push({ id: beneficiary.id, age });
  }
  return parsed;
}

export function lifeLabel(count: number) {
  return `${count} ${count === 1 ? "vida" : "vidas"}`;
}
