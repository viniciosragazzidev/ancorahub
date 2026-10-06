export const AGE_BANDS = [
  { id: "0-18", label: "0 a 18 anos", min: 0, max: 18 },
  { id: "19-23", label: "19 a 23 anos", min: 19, max: 23 },
  { id: "24-28", label: "24 a 28 anos", min: 24, max: 28 },
  { id: "29-33", label: "29 a 33 anos", min: 29, max: 33 },
  { id: "34-38", label: "34 a 38 anos", min: 34, max: 38 },
  { id: "39-43", label: "39 a 43 anos", min: 39, max: 43 },
  { id: "44-48", label: "44 a 48 anos", min: 44, max: 48 },
  { id: "49-53", label: "49 a 53 anos", min: 49, max: 53 },
  { id: "54-58", label: "54 a 58 anos", min: 54, max: 58 },
  { id: "59+", label: "59 anos ou mais", min: 59, max: 120 },
] as const;

export type AgeBandId = (typeof AGE_BANDS)[number]["id"];
export type ProfileType = "individual" | "family" | "pme" | "adhesion";
export type Region = "rj-capital" | "baixada" | "niteroi-sg" | "sp-capital" | "other";
export type Accommodation = "ward" | "private";
export type Copayment = "none" | "partial" | "full";
export type Coverage = "regional" | "state" | "national";

export type MockPlan = {
  id: string;
  carrier: string;
  name: string;
  tier: "Essencial" | "Prático" | "Amplo" | "Premium";
  firstBandMonthlyPrice: number;
  ageBandMultipliers: readonly number[];
  accommodations: readonly Accommodation[];
  copayments: readonly Copayment[];
  coverages: readonly Coverage[];
  regions: readonly Region[];
  dentalIncluded: boolean;
  hospitals: readonly string[];
  waitingPeriodSummary: string;
  averageAnnualAdjustment: number;
  completenessScore: number;
};

export const REGIONS: ReadonlyArray<{ value: Region; label: string }> = [
  { value: "rj-capital", label: "Rio de Janeiro, capital" },
  { value: "baixada", label: "Baixada Fluminense" },
  { value: "niteroi-sg", label: "Niterói e São Gonçalo" },
  { value: "sp-capital", label: "São Paulo, capital" },
  { value: "other", label: "Outra região" },
];

export const HOSPITALS = [
  "Copa D'Or",
  "Barra D'Or",
  "Quinta D'Or",
  "Samaritano",
  "Hospital São Lucas",
  "Hospital Pasteur",
  "Hospital Rios D'Or",
  "Hospital Badim",
  "Hospital São Francisco",
  "Hospital São Luiz",
] as const;

const RJ_HOSPITALS = [
  "Copa D'Or",
  "Barra D'Or",
  "Quinta D'Or",
  "Samaritano",
  "Hospital São Lucas",
  "Hospital Pasteur",
  "Hospital Rios D'Or",
  "Hospital Badim",
  "Hospital São Francisco",
];

const SP_HOSPITALS = ["Hospital São Luiz", "Samaritano"];
const AGE_CURVE = [1, 1.12, 1.24, 1.38, 1.52, 1.7, 2.05, 2.35, 2.7, 3.1] as const;

function createPlan(
  id: string,
  carrier: string,
  name: string,
  tier: MockPlan["tier"],
  firstBandMonthlyPrice: number,
  options: Partial<Omit<MockPlan, "id" | "carrier" | "name" | "tier" | "firstBandMonthlyPrice" | "ageBandMultipliers">> = {},
): MockPlan {
  return {
    id,
    carrier,
    name,
    tier,
    firstBandMonthlyPrice,
    ageBandMultipliers: AGE_CURVE,
    accommodations: options.accommodations ?? ["ward", "private"],
    copayments: options.copayments ?? ["none", "partial", "full"],
    coverages: options.coverages ?? ["regional", "state", "national"],
    regions: options.regions ?? ["rj-capital", "baixada", "niteroi-sg"],
    dentalIncluded: options.dentalIncluded ?? false,
    hospitals: options.hospitals ?? RJ_HOSPITALS.slice(0, 4),
    waitingPeriodSummary: options.waitingPeriodSummary ?? "Prazos sujeitos ao contrato e à análise da operadora.",
    averageAnnualAdjustment: options.averageAnnualAdjustment ?? 12,
    completenessScore: options.completenessScore ?? 3,
  };
}

// Nomes de mercado são rótulos demonstrativos. Operadoras, produtos, redes e valores abaixo são fictícios.
export const MOCK_PLANS: readonly MockPlan[] = [
  createPlan("amil-essencial", "Amil (exemplo)", "S380 Essencial", "Essencial", 268, { hospitals: ["Hospital Pasteur", "Hospital Badim"], coverages: ["regional", "state"], completenessScore: 2, averageAnnualAdjustment: 13.2 }),
  createPlan("amil-amplo", "Amil (exemplo)", "S750 Amplo", "Amplo", 426, { hospitals: RJ_HOSPITALS.slice(0, 7), dentalIncluded: true, completenessScore: 4, averageAnnualAdjustment: 12.8 }),
  createPlan("bradesco-pratico", "Bradesco Saúde (exemplo)", "Efetivo Prático", "Prático", 354, { hospitals: RJ_HOSPITALS.slice(1, 6), coverages: ["regional", "state"], completenessScore: 3, averageAnnualAdjustment: 12.5 }),
  createPlan("bradesco-premium", "Bradesco Saúde (exemplo)", "Nacional Plus", "Premium", 732, { hospitals: RJ_HOSPITALS, coverages: ["state", "national"], dentalIncluded: true, completenessScore: 5, averageAnnualAdjustment: 11.9 }),
  createPlan("sulamerica-essencial", "SulAmérica (exemplo)", "Direto Essencial", "Essencial", 316, { hospitals: RJ_HOSPITALS.slice(0, 4), coverages: ["regional", "state"], completenessScore: 2, averageAnnualAdjustment: 12.1 }),
  createPlan("sulamerica-amplo", "SulAmérica (exemplo)", "Especial 100", "Amplo", 568, { hospitals: RJ_HOSPITALS.slice(1, 8), dentalIncluded: true, completenessScore: 4, averageAnnualAdjustment: 11.6 }),
  createPlan("porto-pratico", "Porto Saúde (exemplo)", "Bronze Mais", "Prático", 392, { regions: ["rj-capital", "sp-capital"], hospitals: ["Copa D'Or", "Barra D'Or", "Hospital São Luiz"], completenessScore: 3, averageAnnualAdjustment: 12 }),
  createPlan("porto-premium", "Porto Saúde (exemplo)", "Ouro Nacional", "Premium", 698, { regions: ["rj-capital", "sp-capital"], hospitals: [...RJ_HOSPITALS.slice(0, 5), ...SP_HOSPITALS], dentalIncluded: true, coverages: ["state", "national"], completenessScore: 5, averageAnnualAdjustment: 11.7 }),
  createPlan("unimed-rio-essencial", "Unimed Rio (exemplo)", "Compacto Rio", "Essencial", 284, { hospitals: RJ_HOSPITALS.slice(4), coverages: ["regional"], completenessScore: 2, averageAnnualAdjustment: 13.5 }),
  createPlan("unimed-rio-amplo", "Unimed Rio (exemplo)", "UniPart Amplo", "Amplo", 448, { hospitals: RJ_HOSPITALS.slice(0, 6), coverages: ["regional", "state"], dentalIncluded: true, completenessScore: 4, averageAnnualAdjustment: 12.9 }),
  createPlan("unimed-ferj-pratico", "Unimed Ferj (exemplo)", "Essencial Ferj", "Prático", 306, { hospitals: RJ_HOSPITALS.slice(2, 7), coverages: ["regional", "state"], completenessScore: 3, averageAnnualAdjustment: 13 }),
  createPlan("unimed-ferj-amplo", "Unimed Ferj (exemplo)", "Amplo Nacional", "Amplo", 524, { hospitals: RJ_HOSPITALS, coverages: ["state", "national"], dentalIncluded: true, completenessScore: 4, averageAnnualAdjustment: 12.4 }),
  createPlan("hapvida-essencial", "Hapvida NotreDame (exemplo)", "Smart Regional", "Essencial", 238, { hospitals: ["Hospital São Lucas", "Hospital Badim"], coverages: ["regional"], accommodations: ["ward"], copayments: ["partial", "full"], completenessScore: 1, averageAnnualAdjustment: 14 }),
  createPlan("hapvida-amplo", "Hapvida NotreDame (exemplo)", "Advance Estadual", "Amplo", 384, { hospitals: RJ_HOSPITALS.slice(3, 8), coverages: ["regional", "state"], dentalIncluded: true, completenessScore: 3, averageAnnualAdjustment: 13.6 }),
  createPlan("assim-essencial", "Assim Saúde (exemplo)", "Max Essencial", "Essencial", 222, { hospitals: RJ_HOSPITALS.slice(5), coverages: ["regional"], accommodations: ["ward"], copayments: ["partial", "full"], completenessScore: 1, averageAnnualAdjustment: 14.2 }),
  createPlan("assim-pratico", "Assim Saúde (exemplo)", "Ideal Mais", "Prático", 332, { hospitals: RJ_HOSPITALS.slice(2, 7), coverages: ["regional", "state"], completenessScore: 3, averageAnnualAdjustment: 13.8 }),
  createPlan("leve-essencial", "Leve Saúde (exemplo)", "Leve Rio", "Essencial", 246, { hospitals: RJ_HOSPITALS.slice(6), coverages: ["regional"], accommodations: ["ward"], completenessScore: 1, averageAnnualAdjustment: 13.9 }),
  createPlan("leve-pratico", "Leve Saúde (exemplo)", "Leve Mais", "Prático", 318, { hospitals: RJ_HOSPITALS.slice(3, 8), coverages: ["regional", "state"], completenessScore: 3, averageAnnualAdjustment: 13.5 }),
  createPlan("golden-essencial", "Golden Cross (exemplo)", "Golden Essencial", "Essencial", 428, { hospitals: RJ_HOSPITALS.slice(0, 5), coverages: ["regional", "state"], completenessScore: 3, averageAnnualAdjustment: 12.6 }),
  createPlan("golden-premium", "Golden Cross (exemplo)", "Golden Executivo", "Premium", 642, { hospitals: RJ_HOSPITALS.slice(0, 8), coverages: ["state", "national"], dentalIncluded: true, completenessScore: 5, averageAnnualAdjustment: 12.2 }),
];

export const MOCK_LEADS = [
  { id: "demo-lead-1", name: "Mariana Oliveira", stage: "Em atendimento" },
  { id: "demo-lead-2", name: "Rafael Costa", stage: "Novo lead" },
  { id: "demo-lead-3", name: "Família Martins", stage: "Cotação enviada" },
] as const;
