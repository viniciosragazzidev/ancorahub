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

/** Operators the question names (by name or alias). */
export function carriersInQuestion(question: string, carriers: NamedEntity[]) {
  const forms = questionForms(question);
  return carriers.filter((carrier) => names(carrier).some((name) => forms.has(name)));
}

/** Plans the question names, with or without the operator name in front. */
export function plansInQuestion(question: string, plans: Array<NamedEntity & { carrierName: string }>) {
  const forms = questionForms(question);
  return plans.filter((plan) => [plan.name, plan.code ?? "", ...(plan.aliases ?? [])]
    .map((name) => planNameCore(name, plan.carrierName))
    .some((core) => core.length >= 3 && forms.has(core)));
}

/** Ages in the question ("35 anos", "titular 42 e filho 8"), turned into the ANS band each one falls in. */
export function ageBandsInQuestion(question: string) {
  const ages = [...question.matchAll(/\b(\d{1,3})\s*(?:anos?|a\b)/gi)].map((match) => Number(match[1])).filter((age) => age >= 0 && age <= 120);
  const bands = ["0-18", "19-23", "24-28", "29-33", "34-38", "39-43", "44-48", "49-53", "54-58", "59+"];
  return [...new Set(ages.map((age) => bands.find((band) => {
    const [min, max] = band.endsWith("+") ? [Number(band.slice(0, -1)), 200] : band.split("-").map(Number);
    return age >= (min ?? 0) && age <= (max ?? 200);
  }) ?? normalizeAgeBand(String(age))))];
}
