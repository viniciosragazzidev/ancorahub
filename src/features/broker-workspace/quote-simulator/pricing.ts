import { AGE_BANDS, type Accommodation, type Copayment, type Coverage, type MockPlan, type ProfileType, type Region } from "./mock-data";

export type BeneficiaryInput = { id: string; age: number };
export type PricingPreferences = {
  profileType: ProfileType;
  region: Region;
  accommodation: Accommodation;
  copayment: Copayment;
  coverage: Coverage;
  includeDental: boolean;
};
export type BeneficiaryPrice = BeneficiaryInput & {
  ageBandLabel: string;
  monthlyPrice: number;
};
export type PlanPricing = {
  beneficiaries: BeneficiaryPrice[];
  monthlyTotal: number;
  monthlyPerLife: number;
};

const REGION_MULTIPLIER: Record<Region, number> = {
  "rj-capital": 1.08,
  baixada: 1,
  "niteroi-sg": 1.03,
  "sp-capital": 1.15,
  other: 0.94,
};
const ACCOMMODATION_MULTIPLIER: Record<Accommodation, number> = { ward: 1, private: 1.28 };
const COPAYMENT_MULTIPLIER: Record<Copayment, number> = { none: 1.2, partial: 1, full: 0.82 };
const COVERAGE_MULTIPLIER: Record<Coverage, number> = { regional: 1, state: 1.09, national: 1.22 };
const PROFILE_MULTIPLIER: Record<ProfileType, number> = { individual: 1, family: 1, pme: 0.96, adhesion: 0.92 };
const DENTAL_MONTHLY_PRICE = 19;

function toCents(value: number): number {
  return Math.round(value * 100);
}

export function getAgeBand(age: number) {
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw new RangeError("A idade deve ser um número inteiro entre 0 e 120.");
  }
  return AGE_BANDS.find((band) => age >= band.min && age <= band.max) ?? AGE_BANDS[0];
}

export function calculatePlanPricing(
  plan: MockPlan,
  preferences: PricingPreferences,
  beneficiaries: readonly BeneficiaryInput[],
): PlanPricing {
  if (beneficiaries.length === 0) {
    return { beneficiaries: [], monthlyTotal: 0, monthlyPerLife: 0 };
  }
  if (plan.ageBandMultipliers.length !== AGE_BANDS.length) {
    throw new RangeError("O plano deve fornecer um preço para cada faixa etária.");
  }
  if (!plan.accommodations.includes(preferences.accommodation)) {
    throw new RangeError("A acomodação não está disponível neste plano.");
  }
  if (!plan.copayments.includes(preferences.copayment)) {
    throw new RangeError("A coparticipação não está disponível neste plano.");
  }
  if (!plan.coverages.includes(preferences.coverage)) {
    throw new RangeError("A abrangência não está disponível neste plano.");
  }

  const factor = REGION_MULTIPLIER[preferences.region]
    * ACCOMMODATION_MULTIPLIER[preferences.accommodation]
    * COPAYMENT_MULTIPLIER[preferences.copayment]
    * COVERAGE_MULTIPLIER[preferences.coverage]
    * PROFILE_MULTIPLIER[preferences.profileType];
  const beneficiariesWithPrices = beneficiaries.map((beneficiary) => {
    const ageBand = getAgeBand(beneficiary.age);
    const bandIndex = AGE_BANDS.findIndex((band) => band.id === ageBand.id);
    const agePrice = plan.firstBandMonthlyPrice * plan.ageBandMultipliers[bandIndex];
    const dentalPrice = preferences.includeDental && !plan.dentalIncluded ? DENTAL_MONTHLY_PRICE : 0;
    const monthlyPrice = toCents(agePrice * factor + dentalPrice) / 100;
    return { ...beneficiary, ageBandLabel: ageBand.label, monthlyPrice };
  });
  const monthlyTotal = toCents(beneficiariesWithPrices.reduce((sum, beneficiary) => sum + beneficiary.monthlyPrice, 0)) / 100;
  return {
    beneficiaries: beneficiariesWithPrices,
    monthlyTotal,
    monthlyPerLife: toCents(monthlyTotal / beneficiaries.length) / 100,
  };
}

export function isAnsAgeTableCompliant(plan: MockPlan): boolean {
  if (plan.ageBandMultipliers.length !== 10) return false;
  const values = plan.ageBandMultipliers;
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return false;
  if (values.some((value, index) => index > 0 && value < values[index - 1])) return false;
  const first = values[0];
  const seventh = values[6];
  const tenth = values[9];
  const epsilon = 1e-9; // decimal multipliers: 3.1 - 2.05 vs 2.05 - 1 differ only by float error
  return tenth <= first * 6 + epsilon && tenth - seventh <= seventh - first + epsilon;
}
