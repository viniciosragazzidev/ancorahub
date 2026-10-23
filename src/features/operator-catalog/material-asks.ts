/**
 * Questions ready to tap, made from what the operator material actually has (Jack, 23/10):
 * an operator with a price table suggests its prices, one with a hospital list suggests
 * its hospitals, and so on. Nothing is suggested for a subject with no material, so a tap
 * never lands on "não encontrei". They rotate by day so the broker sees new ones.
 * Pure: tested in material-asks.test.ts.
 */

export type MaterialCoverage = { carrierName: string; planName: string | null; areaSlug: string; facts: number };
export type MaterialAsk = { id: string; label: string; question: string; areaSlug: string; carrierName: string };

/** "Amil" + "Amil S380" reads "Amil S380", not "Amil Amil S380". */
function fullName(carrier: string, plan: string | null) {
  if (!plan) return carrier;
  return plan.toLowerCase().startsWith(carrier.toLowerCase()) ? plan : `${carrier} ${plan}`;
}

type Template = (subject: { carrier: string; plan: string | null }) => { label: string; question: string };

const TEMPLATES: Record<string, Template> = {
  precos: ({ carrier, plan }) => ({
    label: `Preços ${plan ?? carrier} para 2 vidas`,
    question: `Quanto fica ${fullName(carrier, plan)} para 2 vidas de 30 e 25 anos?`,
  }),
  rede_credenciada: ({ carrier, plan }) => ({
    label: `Hospitais da ${plan ?? carrier}`,
    question: `Quais hospitais atendem a ${fullName(carrier, plan)}?`,
  }),
  carencias: ({ carrier }) => ({ label: `Carências da ${carrier}`, question: `Quais são as carências da ${carrier}?` }),
  coparticipacao: ({ carrier, plan }) => ({
    label: `Coparticipação da ${plan ?? carrier}`,
    question: `Como funciona a coparticipação da ${fullName(carrier, plan)}?`,
  }),
  regras_aceitacao: ({ carrier }) => ({ label: `Quem pode contratar ${carrier}`, question: `Quais são as regras de aceitação da ${carrier}?` }),
  documentos: ({ carrier }) => ({ label: `Documentos para fechar ${carrier}`, question: `Quais documentos preciso para fechar um plano ${carrier}?` }),
  abrangencia_regiao: ({ carrier, plan }) => ({
    label: `Onde a ${plan ?? carrier} atende`,
    question: `Qual a abrangência da ${fullName(carrier, plan)}?`,
  }),
  reajuste: ({ carrier }) => ({ label: `Reajuste da ${carrier}`, question: `Como é o reajuste da ${carrier}?` }),
  promocoes: ({ carrier }) => ({ label: `Promoções da ${carrier}`, question: `Quais promoções a ${carrier} tem agora?` }),
};

/** Areas whose answer is usually about one plan (the plan with most material is named). */
const PLAN_AREAS = new Set(["precos", "rede_credenciada", "coparticipacao", "abrangencia_regiao"]);

export function buildMaterialAsks(rows: MaterialCoverage[], options: { seed: number; limit: number; focusCarrier?: string | null; excludeAreas?: string[] }): MaterialAsk[] {
  const focus = options.focusCarrier?.trim().toLowerCase() || null;
  const excluded = new Set(options.excludeAreas ?? []);
  // One subject per operator and area: the plan with most facts names it.
  const subjects = new Map<string, { carrier: string; plan: string | null; areaSlug: string; facts: number }>();
  for (const row of rows) {
    if (!TEMPLATES[row.areaSlug] || excluded.has(row.areaSlug)) continue;
    if (focus && row.carrierName.toLowerCase() !== focus) continue;
    const key = `${row.carrierName}|${row.areaSlug}`;
    const known = subjects.get(key);
    const plan = PLAN_AREAS.has(row.areaSlug) ? row.planName : null;
    if (!known) subjects.set(key, { carrier: row.carrierName, plan, areaSlug: row.areaSlug, facts: row.facts });
    else {
      if (plan && (!known.plan || row.facts > known.facts)) known.plan = plan;
      known.facts += row.facts;
    }
  }
  const ranked = [...subjects.values()].sort((a, b) => b.facts - a.facts || a.areaSlug.localeCompare(b.areaSlug));
  if (!ranked.length) return [];
  // Rotate by the seed, then prefer different areas and operators.
  const start = Math.abs(options.seed) % ranked.length;
  const rotated = [...ranked.slice(start), ...ranked.slice(0, start)];
  const picked: typeof ranked = [];
  const usedAreas = new Set<string>();
  for (const subject of rotated) {
    if (picked.length >= options.limit) break;
    if (usedAreas.has(subject.areaSlug)) continue;
    picked.push(subject);
    usedAreas.add(subject.areaSlug);
  }
  for (const subject of rotated) {
    if (picked.length >= options.limit) break;
    if (!picked.includes(subject)) picked.push(subject);
  }
  return picked.map((subject) => {
    const text = TEMPLATES[subject.areaSlug]!({ carrier: subject.carrier, plan: subject.plan });
    return { id: `material-${subject.areaSlug}-${subject.carrier}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"), ...text, areaSlug: subject.areaSlug, carrierName: subject.carrier };
  });
}

/** The subjects a question is about, so the follow-ups suggest the other ones. */
export function questionAreas(question: string) {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const areas: string[] = [];
  if (/\b(valor|valores|preco|precos|quanto|mensalidade|tabela|custa|custo)\b/.test(text)) areas.push("precos");
  if (/hospita|rede|credenciad|laboratori|clinica/.test(text)) areas.push("rede_credenciada");
  if (/carencia/.test(text)) areas.push("carencias");
  if (/copart/.test(text)) areas.push("coparticipacao");
  if (/document/.test(text)) areas.push("documentos");
  if (/aceitac|quem pode|contratar/.test(text)) areas.push("regras_aceitacao");
  if (/reajuste/.test(text)) areas.push("reajuste");
  if (/promoc/.test(text)) areas.push("promocoes");
  if (/abrangencia|onde atende|regiao/.test(text)) areas.push("abrangencia_regiao");
  return areas;
}
