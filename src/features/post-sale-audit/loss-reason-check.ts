/**
 * R4 (motivo da perda): compara o motivo que o cliente deu com o que o corretor registrou (09/11).
 * Os dois lados viram uma categoria curta; categorias diferentes, e nenhuma "outro", geram o alerta
 * "Motivo de perda diferente do registrado". Puro, sem I/O: a tela também importa.
 */

export const LOSS_REASON_CATEGORIES = ["price", "has_plan", "gave_up", "not_attended", "coverage", "other"] as const;
export type LossReasonCategory = (typeof LOSS_REASON_CATEGORIES)[number];

export const LOSS_REASON_CATEGORY_LABELS: Record<LossReasonCategory, string> = {
  price: "Preço",
  has_plan: "Já tem plano ou fechou com outro",
  gave_up: "Desistiu ou sem interesse",
  not_attended: "Não foi atendido ou sem contato",
  coverage: "Documentação, carência ou rede",
  other: "Outro",
};

/** Códigos do catálogo (`MOTIVOS_PERDA`) e categorias de perda do sistema (`leads.loss_category`). */
const CODE_CATEGORIES: Record<string, readonly LossReasonCategory[]> = {
  preco: ["price"],
  encontrou_mais_barato: ["price", "has_plan"],
  ja_contratou: ["has_plan"],
  desistiu: ["gave_up"],
  sem_interesse: ["gave_up"],
  sem_contato: ["not_attended"],
  "carência": ["coverage"],
  carencia: ["coverage"],
  problema_saude: ["coverage"],
  nao_qualificado: ["other"],
  outro: ["other"],
  unattended_sla: ["not_attended"],
  response_delay: ["not_attended"],
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Ordem importa: "ninguém me respondeu, fechei com outra" é falta de atendimento. */
const KEYWORDS: Array<[LossReasonCategory, RegExp]> = [
  ["not_attended", /\b(ninguem (me )?(atendeu|respondeu|retornou|ligou|chamou|procurou)|nao (fui|foi|fomos) atendid|nao me (atenderam|atendeu|responderam|respondeu|retornaram|retornou|ligaram|ligou|chamaram|chamou|procurou|procuraram)|nunca (me )?(respond|retorn|lig|atend|cham)|sem (contato|retorno|resposta|atendimento)|nao (atende|atendia|respondeu|responderam|retornou|retornaram)|nao entr(ou|aram) em contato|demor(ou|aram|a) (muito )?(para|pra|a) (responder|retornar|atender)|demora no atendimento|sumiu|me deixou no vacuo|falta de (atendimento|retorno))/],
  ["has_plan", /\b(ja (tenho|tem|temos|possuo|estou com|to com|fiz|contratei|fechei|contratou|fechou)|fechei com|fechamos com|contratei (com )?(outr|a |o )|outra (corretora|operadora|empresa|seguradora)|outro (corretor|plano|lugar)|plano (da|do|pela|pelo) (empresa|trabalho|servico)|convenio (da|do) (empresa|trabalho)|fiquei com (o|a|meu|minha)|continuei com|mantive (o|meu|a|minha))/],
  ["price", /\b(preco|precos|caro|cara demais|muito cara|achei cara|ficou cara|valor|valores|mensalidade|orcamento|mais barat|custo|nao cabe no bolso|nao coube|sem dinheiro|dinheiro|apertad|financeir|reajuste)/],
  ["coverage", /\b(carencia|carencias|rede|hospita|cobertura|documenta|documento|cnpj|mei\b|laboratorio|medic|preexistente|reembolso|abrangencia|regiao|nao cobre|cpt)/],
  ["gave_up", /\b(desist|sem interesse|nao tenho (mais )?interesse|perdi o interesse|nao quero mais|mudei de ideia|deixei (pra|para) (depois|la)|depois eu vejo|nao (e|eh) o momento|agora nao|adiei|mais (pra|para) frente|nao preciso|resolvi esperar|vou esperar|nao vou (fazer|contratar))/],
];

/** Categoria de um texto livre (resposta do cliente ou motivo escrito pelo corretor). Sem pista: "other". */
export function classifyLossReasonText(text: string | null | undefined): LossReasonCategory {
  const value = normalize(text ?? "");
  if (!value) return "other";
  const code = CODE_CATEGORIES[value] ?? CODE_CATEGORIES[value.replace(/\s+/g, "_")];
  if (code) return code[0];
  for (const [category, pattern] of KEYWORDS) if (pattern.test(value)) return category;
  return "other";
}

/** Categorias do motivo do corretor: código do catálogo, categoria do sistema ou texto livre do histórico. */
export function brokerLossCategories(texts: ReadonlyArray<string | null | undefined>): LossReasonCategory[] {
  const categories = new Set<LossReasonCategory>();
  for (const text of texts) {
    const raw = text?.trim();
    if (!raw) continue;
    const code = CODE_CATEGORIES[raw] ?? CODE_CATEGORIES[normalize(raw)];
    const found = code ?? [classifyLossReasonText(raw)];
    for (const category of found) if (category !== "other") categories.add(category);
  }
  return [...categories];
}

export function isLossReasonCategory(value: unknown): value is LossReasonCategory {
  return typeof value === "string" && (LOSS_REASON_CATEGORIES as readonly string[]).includes(value);
}

export type LossReasonCheck = {
  divergent: boolean;
  client: { category: LossReasonCategory; text: string | null; source: "ai" | "keywords" };
  broker: { categories: LossReasonCategory[]; text: string | null };
};

/**
 * Compara o motivo do cliente (categoria da IA quando houver, senão palavras-chave) com o do corretor.
 * Diverge quando os dois lados têm categoria conhecida (nenhum "outro") e a do cliente não está entre as
 * do corretor ("encontrou mais barato" vale como preço e como fechou com outro).
 */
export function compareLossReasons(input: {
  clientText: string | null | undefined;
  clientAiCategory?: unknown;
  brokerTexts: ReadonlyArray<string | null | undefined>;
  brokerLabel?: string | null;
}): LossReasonCheck {
  const clientText = input.clientText?.trim() ? input.clientText.trim().slice(0, 300) : null;
  const ai = isLossReasonCategory(input.clientAiCategory) ? input.clientAiCategory : null;
  const clientCategory = ai ?? classifyLossReasonText(clientText);
  const brokerCategories = brokerLossCategories(input.brokerTexts);
  const brokerText = input.brokerLabel?.trim() || input.brokerTexts.find((text) => text?.trim())?.trim() || null;
  const divergent = clientCategory !== "other" && brokerCategories.length > 0 && !brokerCategories.includes(clientCategory);
  return {
    divergent,
    client: { category: clientCategory, text: clientText, source: ai ? "ai" : "keywords" },
    broker: { categories: brokerCategories.length ? brokerCategories : ["other"], text: brokerText ? brokerText.slice(0, 300) : null },
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Lê o resultado gravado em `answers.lossCheck` (tolerante a dado antigo ou parcial). */
export function readLossReasonCheck(answers: unknown): LossReasonCheck | null {
  const check = record(record(answers)?.lossCheck);
  if (!check) return null;
  const client = record(check.client);
  const broker = record(check.broker);
  if (!client || !broker || !isLossReasonCategory(client.category)) return null;
  const categories = Array.isArray(broker.categories) ? broker.categories.filter(isLossReasonCategory) : [];
  return {
    divergent: check.divergent === true,
    client: { category: client.category, text: typeof client.text === "string" ? client.text : null, source: client.source === "ai" ? "ai" : "keywords" },
    broker: { categories: categories.length ? categories : ["other"], text: typeof broker.text === "string" ? broker.text : null },
  };
}

/** "Corretor: Preço (Preço acima do esperado). Cliente: Não foi atendido ou sem contato ("ninguém me ligou")." */
export function lossReasonCheckSummary(check: LossReasonCheck) {
  const brokerCategories = check.broker.categories.map((category) => LOSS_REASON_CATEGORY_LABELS[category]).join(" / ");
  const broker = check.broker.text ? `${brokerCategories} (${check.broker.text})` : brokerCategories;
  const client = check.client.text ? `${LOSS_REASON_CATEGORY_LABELS[check.client.category]} ("${check.client.text.slice(0, 160)}")` : LOSS_REASON_CATEGORY_LABELS[check.client.category];
  return `Corretor: ${broker}. Cliente: ${client}.`;
}
