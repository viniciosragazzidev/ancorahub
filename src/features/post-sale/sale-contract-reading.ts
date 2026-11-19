import type { SaleContractReading, SalePaymentMethod, SalePerson, SalePlanType, SaleRelationship } from "./conversation-sale-core";

const TYPES: SalePlanType[] = ["individual", "familiar", "pme", "empresarial"];
const PAYMENTS: SalePaymentMethod[] = ["boleto", "debito_automatico", "cartao_credito", "desconto_folha", "outro"];
const RELATIONSHIPS: SaleRelationship[] = ["titular", "conjuge", "filho", "outro"];

/** Pedido à IA de leitura do contrato: só JSON, nada inventado. `today` entra para calcular idades. */
export function contractInstruction(today: string) {
  return `Você lê contratos, propostas e termos de adesão de plano de saúde do Brasil. Responda SOMENTE com um JSON, sem texto antes ou depois, neste formato:
{"planType": "individual" | "familiar" | "pme" | "empresarial" | null,
 "holder": {"name": "nome completo do titular", "birthDate": "AAAA-MM-DD" ou null, "age": idade em anos ou null, "cpf": "só os 11 números" ou null} ou null,
 "dependents": [{"name": "nome completo", "birthDate": "AAAA-MM-DD" ou null, "age": idade ou null, "cpf": "11 números" ou null, "relationship": "conjuge" | "filho" | "outro"}],
 "carrierName": "nome da operadora" ou null,
 "planName": "nome comercial do plano" ou null,
 "monthlyValue": mensalidade total em reais como número (ex.: 1250.9) ou null,
 "coverageStartDate": "AAAA-MM-DD" do início da vigência ou null,
 "policyNumber": "número da apólice, do contrato ou da proposta" ou null,
 "paymentMethod": "boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro" | null,
 "contractTermMonths": prazo do contrato em meses ou null}
Regras: se só houver data de nascimento, calcule a idade em ${today}; o valor é a mensalidade somando todas as vidas (não a taxa de adesão nem a primeira parcela com acréscimos); "dependents" vazio se não houver; use null no que não estiver escrito. Não invente nada.`;
}

const str = (value: unknown, max = 120) => (typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, max) : null);
const isoDate = (value: unknown) => {
  const text = str(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};
const age = (value: unknown) => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) && number >= 0 && number <= 120 ? number : null;
};
const cpf = (value: unknown) => {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return digits.length === 11 ? digits : null;
};

function person(raw: unknown, relationship: SaleRelationship | null): SalePerson | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const name = str(item.name, 160);
  const parsed: SalePerson = {
    name: name ? name.toLocaleLowerCase("pt-BR").replace(/(^|\s)\p{L}/gu, (char) => char.toLocaleUpperCase("pt-BR")).replace(/\s(D[aeo]s?|E)\s/g, (word) => word.toLowerCase()) : null,
    birthDate: isoDate(item.birthDate),
    age: age(item.age),
    cpf: cpf(item.cpf),
    relationship: relationship ?? (typeof item.relationship === "string" && (RELATIONSHIPS as string[]).includes(item.relationship) && item.relationship !== "titular" ? item.relationship as SaleRelationship : "outro"),
  };
  return parsed.name || parsed.age != null || parsed.birthDate ? parsed : null;
}

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
  const planType = typeof raw.planType === "string" && (TYPES as string[]).includes(raw.planType) ? (raw.planType as SalePlanType) : null;
  const ages = Array.isArray(raw.ages) ? raw.ages.map(age).filter((value): value is number => value != null).slice(0, 30) : null;
  const value = typeof raw.monthlyValue === "string" ? Number(raw.monthlyValue.replace(/\./g, "").replace(",", ".")) : raw.monthlyValue;
  const monthlyValue = typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000 ? value : null;
  const term = typeof raw.contractTermMonths === "string" ? Number(raw.contractTermMonths) : raw.contractTermMonths;
  const dependents = Array.isArray(raw.dependents) ? raw.dependents.map((item) => person(item, null)).filter((item): item is SalePerson => Boolean(item)).slice(0, 29) : [];
  return {
    planType,
    ages: ages?.length ? ages : null,
    holder: person(raw.holder, "titular"),
    dependents: dependents.length ? dependents : null,
    carrierName: str(raw.carrierName),
    planName: str(raw.planName),
    monthlyValue,
    coverageStartDate: isoDate(raw.coverageStartDate),
    policyNumber: str(raw.policyNumber, 60),
    paymentMethod: typeof raw.paymentMethod === "string" && (PAYMENTS as string[]).includes(raw.paymentMethod) ? raw.paymentMethod as SalePaymentMethod : null,
    contractTermMonths: typeof term === "number" && Number.isInteger(term) && term >= 1 && term <= 120 ? term : null,
  };
}
