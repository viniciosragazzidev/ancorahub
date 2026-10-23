import { planNameCore, type NamedEntity } from "./matching";
import { normalizeAgeBand, normalizeName } from "./taxonomy";

/** Words of the question in the same form as catalog names ("Amil S 380" -> "amils380" pieces). */
function questionForms(question: string) {
  const words = question
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const forms = new Set<string>();
  // Single words and runs of up to four words glued together: "s 380 qc" -> "s380qc".
  for (let start = 0; start < words.length; start += 1) {
    let glued = "";
    for (let size = 0; size < 4 && start + size < words.length; size += 1) {
      glued += words[start + size];
      forms.add(glued);
    }
  }
  return forms;
}

function names(entity: NamedEntity) {
  return [entity.name, entity.code ?? "", ...(entity.aliases ?? [])].map(normalizeName).filter((name) => name.length >= 3);
}

/** Words that only say what kind of company it is ("Bradesco Saúde" is asked as "Bradesco"). */
const CARRIER_GENERIC_WORDS = new Set(["saude", "seguros", "seguro", "sa", "ltda", "planos", "plano", "de", "do", "da", "assistencia", "medica", "medical", "life"]);
/** Short names that are also common words: "assim" alone does not mean ASSIM SAÚDE. */
const CARRIER_CORE_STOPWORDS = new Set(["assim", "vida", "nossa", "sao", "santa", "uniao", "porto"]);

/** The distinctive part of an operator name: "Bradesco Saúde" -> "bradesco", "SulAmérica Saúde" -> "sulamerica". */
export function carrierCoreName(name: string) {
  const words = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const core = words.filter((word) => !CARRIER_GENERIC_WORDS.has(word)).join("");
  return core.length >= 4 && core !== words.join("") && !CARRIER_CORE_STOPWORDS.has(core) ? core : null;
}

/** Operators the question names (by name, alias or the distinctive part of the name). */
export function carriersInQuestion(question: string, carriers: NamedEntity[]) {
  const forms = questionForms(question);
  return carriers.filter((carrier) => {
    const core = carrierCoreName(carrier.name);
    return names(carrier).some((name) => forms.has(name)) || Boolean(core && forms.has(core));
  });
}

/** Plans the question names, with or without the operator name in front. */
export function plansInQuestion(question: string, plans: Array<NamedEntity & { carrierName: string }>) {
  const forms = questionForms(question);
  return plans.filter((plan) => [plan.name, plan.code ?? "", ...(plan.aliases ?? [])]
    .map((name) => planNameCore(name, plan.carrierName))
    .some((core) => core.length >= 3 && forms.has(core)));
}

/** Ages in the question ("35 anos", "titular 42 e filho 8"), turned into the ANS band each one falls in. */
/**
 * Ages of the people in the question. "35 anos" always counts; when the question
 * talks about people (vidas, idades, titular, dependente...), bare numbers count
 * too: "2 vidas 33,24" is two people of 33 and 24 (22/10, read before as R$ 33,24).
 * The number of lives itself ("2 vidas") and money ("R$ 33,24") are not ages.
 */
export function agesInQuestion(question: string) {
  const ages = [...question.matchAll(/\b(\d{1,3})\s*(?:anos?|a\b)/gi)].map((match) => Number(match[1]));
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(vidas?|idades?|titular|dependentes?|pessoas?|beneficiarios?|filhos?|esposa|marido|conjuge)\b/.test(text)) {
    const cleaned = text
      .replace(/r\$\s*\d[\d.,]*/g, " ")
      .replace(/\b\d{1,3}\s*(?:vidas?|pessoas?|beneficiarios?|dependentes?|filhos?)\b/g, " ")
      .replace(/\b\d{1,3}\s*(?:anos?)\b/g, " ")
      .replace(/\b\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?\b/g, " ")
      .replace(/\b\d+\s*%/g, " ");
    for (const match of cleaned.matchAll(/\d+/g)) {
      const value = Number(match[0]);
      if (match[0].length <= 3 && value <= 120) ages.push(value);
    }
  }
  return [...new Set(ages.filter((age) => age >= 0 && age <= 120))];
}

export function ageBandsInQuestion(question: string) {
  const ages = agesInQuestion(question);
  const bands = ["0-18", "19-23", "24-28", "29-33", "34-38", "39-43", "44-48", "49-53", "54-58", "59+"];
  return [...new Set(ages.map((age) => bands.find((band) => {
    const [min, max] = band.endsWith("+") ? [Number(band.slice(0, -1)), 200] : band.split("-").map(Number);
    return age >= (min ?? 0) && age <= (max ?? 200);
  }) ?? normalizeAgeBand(String(age))))];
}

/** "2 vidas", "para 3 pessoas": how many lives the quote is for, when the question says it. */
export function livesInQuestion(question: string) {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const match = text.match(/\b(\d{1,3})\s*(?:vidas?|pessoas?|beneficiarios?)\b/);
  const lives = match ? Number(match[1]) : null;
  return lives && lives > 0 ? lives : null;
}

/**
 * Whether a table's "vidas" qualifier ("2", "3_a_4", "3_4", "30_a_99", "2_a_29", "30+")
 * covers this many lives. A qualifier it cannot read counts as covering.
 */
export function livesQualifierCovers(qualifier: string | null | undefined, lives: number) {
  if (!qualifier) return true;
  const numbers = qualifier.match(/\d+/g)?.map(Number) ?? [];
  if (!numbers.length) return true;
  if (numbers.length === 1) return /\+|mais|acima/.test(qualifier) ? lives >= numbers[0]! : lives === numbers[0];
  return lives >= Math.min(...numbers) && lives <= Math.max(...numbers);
}
