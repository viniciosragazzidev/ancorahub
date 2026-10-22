/**
 * The operator catalog's shape, shared by every operator: Amil's plan list and
 * Assim's plan list land in the same "planos" area with the same fields. New
 * areas and fields come from the AI as suggestions and join after approval
 * (operator_catalog_areas / operator_catalog_suggestions).
 */

export type CatalogFieldType = "text" | "number" | "money" | "percent" | "days" | "date" | "list" | "boolean";

export type CatalogField = {
  key: string;
  label: string;
  type: CatalogFieldType;
  /** Shown to the AI so it puts each value in the right field. */
  hint?: string;
};

export type CatalogArea = {
  slug: string;
  label: string;
  description: string;
  fields: CatalogField[];
  /** A change here waits for the director instead of going live. */
  reviewRequired?: boolean;
  system?: boolean;
};

const BASE_AREAS: CatalogArea[] = [
  {
    slug: "planos",
    label: "Planos",
    description: "Produtos da operadora e as características de cada plano.",
    reviewRequired: true,
    fields: [
      { key: "nome_comercial", label: "Nome comercial", type: "text" },
      { key: "codigo_ans", label: "Registro ANS", type: "text" },
      { key: "tipo_contratacao", label: "Tipo de contratação", type: "text", hint: "individual, familiar, pme, adesao, empresarial" },
      { key: "segmentacao", label: "Segmentação", type: "text", hint: "ambulatorial, hospitalar, hospitalar com obstetrícia, referência, odontológico" },
      { key: "acomodacao", label: "Acomodação", type: "text", hint: "enfermaria ou apartamento" },
      { key: "abrangencia", label: "Abrangência", type: "text", hint: "municipal, grupo de municípios, estadual, regional, nacional" },
      { key: "area_comercializacao", label: "Área de comercialização", type: "list", hint: "cidades ou estados onde o plano é vendido" },
      { key: "linha", label: "Linha do produto", type: "text" },
      { key: "idade_maxima_entrada", label: "Idade máxima de entrada", type: "number" },
    ],
  },
  {
    slug: "precos",
    label: "Tabela de preços",
    description: "Mensalidade por faixa etária, com as condições da tabela.",
    reviewRequired: true,
    fields: [
      { key: "mensalidade", label: "Mensalidade", type: "money", hint: "valor por pessoa; use os qualificadores faixa_etaria, acomodacao, coparticipacao, vidas, regiao" },
      { key: "taxa_adesao", label: "Taxa de adesão", type: "money" },
      { key: "taxa_associativa", label: "Taxa associativa", type: "money" },
    ],
  },
  {
    slug: "rede_credenciada",
    label: "Rede credenciada",
    description: "Hospitais, laboratórios e clínicas de cada plano.",
    fields: [
      { key: "hospital", label: "Hospital", type: "text", hint: "um fato por hospital, com cidade e bairro nos qualificadores" },
      { key: "laboratorio", label: "Laboratório", type: "text" },
      { key: "pronto_socorro", label: "Pronto-socorro", type: "text" },
      { key: "maternidade", label: "Maternidade", type: "text" },
      { key: "clinica", label: "Clínica", type: "text" },
    ],
  },
  {
    slug: "carencias",
    label: "Carências",
    description: "Prazos de carência por tipo de atendimento e suas reduções.",
    fields: [
      { key: "urgencia_emergencia", label: "Urgência e emergência", type: "days" },
      { key: "consultas_exames_simples", label: "Consultas e exames simples", type: "days" },
      { key: "exames_complexos", label: "Exames complexos", type: "days" },
      { key: "internacao", label: "Internação e cirurgia", type: "days" },
      { key: "parto", label: "Parto", type: "days" },
      { key: "doencas_preexistentes", label: "Doenças preexistentes (CPT)", type: "days" },
      { key: "reducao_carencia", label: "Redução de carência", type: "text", hint: "regras de aproveitamento ou redução; use qualificadores para a condição" },
    ],
  },
  {
    slug: "regras_aceitacao",
    label: "Regras de aceitação",
    description: "Quem pode contratar: vidas, CNPJ, MEI, idade, vínculo.",
    fields: [
      { key: "vidas_minimas", label: "Vidas mínimas", type: "number" },
      { key: "vidas_maximas", label: "Vidas máximas", type: "number" },
      { key: "tempo_minimo_cnpj", label: "Tempo mínimo de CNPJ", type: "text" },
      { key: "aceita_mei", label: "Aceita MEI", type: "boolean" },
      { key: "vinculo_exigido", label: "Vínculo exigido", type: "text", hint: "sócio, funcionário CLT, dependentes aceitos" },
      { key: "dependentes_aceitos", label: "Dependentes aceitos", type: "list" },
      { key: "declaracao_saude", label: "Declaração de saúde", type: "text" },
    ],
  },
  {
    slug: "documentos",
    label: "Documentos exigidos",
    description: "Documentos para fechar a proposta.",
    fields: [
      { key: "documento_titular", label: "Documento do titular", type: "text" },
      { key: "documento_dependente", label: "Documento do dependente", type: "text" },
      { key: "documento_empresa", label: "Documento da empresa", type: "text" },
    ],
  },
  {
    slug: "coparticipacao",
    label: "Coparticipação",
    description: "Percentuais e tetos pagos pelo cliente em cada uso.",
    fields: [
      { key: "percentual", label: "Percentual", type: "percent", hint: "use o qualificador procedimento" },
      { key: "teto_por_procedimento", label: "Teto por procedimento", type: "money" },
      { key: "teto_mensal", label: "Teto mensal", type: "money" },
    ],
  },
  {
    slug: "abrangencia_regiao",
    label: "Abrangência e região",
    description: "Onde o plano atende e onde pode ser vendido.",
    fields: [
      { key: "municipios_atendidos", label: "Municípios atendidos", type: "list" },
      { key: "estados_atendidos", label: "Estados atendidos", type: "list" },
      { key: "regiao_tabela", label: "Região da tabela", type: "text" },
    ],
  },
  {
    slug: "promocoes",
    label: "Promoções e campanhas",
    description: "Descontos, isenções e reduções com prazo.",
    reviewRequired: true,
    fields: [
      { key: "nome_campanha", label: "Campanha", type: "text" },
      { key: "desconto", label: "Desconto", type: "percent" },
      { key: "beneficio", label: "Benefício", type: "text", hint: "isenção de taxa, redução de carência, bônus" },
      { key: "condicao", label: "Condição", type: "text" },
    ],
  },
  {
    slug: "reajuste",
    label: "Reajuste",
    description: "Data-base e percentuais de reajuste.",
    fields: [
      { key: "mes_aniversario", label: "Mês de aniversário", type: "text" },
      { key: "percentual_ultimo_reajuste", label: "Último reajuste", type: "percent" },
      { key: "reajuste_faixa_etaria", label: "Reajuste por faixa etária", type: "text" },
    ],
  },
  {
    slug: "comissionamento",
    label: "Comissionamento",
    description: "Comissão e premiação do corretor.",
    reviewRequired: true,
    fields: [
      { key: "comissao", label: "Comissão", type: "percent", hint: "use o qualificador parcela" },
      { key: "premiacao", label: "Premiação", type: "text" },
    ],
  },
  {
    slug: "regras_venda",
    label: "Regras de venda",
    description: "Prazos de envio, vigência de contrato, pagamento e outras regras operacionais.",
    fields: [
      { key: "data_corte", label: "Data de corte", type: "text" },
      { key: "vigencia_contrato", label: "Início de vigência", type: "text" },
      { key: "forma_pagamento", label: "Forma de pagamento", type: "text" },
      { key: "regra", label: "Regra", type: "text", hint: "qualquer regra operacional que não caiba nos outros campos" },
    ],
  },
];

export const SYSTEM_AREAS: CatalogArea[] = BASE_AREAS.map((area) => ({ ...area, system: true }));

/** What the AI reads the file as. "cotacao" values are observed prices, never the official table. */
export const DOCUMENT_TYPES = [
  { key: "tabela_precos", label: "Tabela de preços" },
  { key: "cotacao", label: "Cotação" },
  { key: "rede_credenciada", label: "Rede credenciada" },
  { key: "manual_regras", label: "Manual e regras" },
  { key: "promocao", label: "Promoção ou campanha" },
  { key: "material_venda", label: "Material de venda" },
  { key: "formulario", label: "Formulário ou proposta" },
  { key: "comunicado", label: "Comunicado" },
  { key: "outro", label: "Outro" },
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number]["key"];
export const DOCUMENT_TYPE_KEYS = DOCUMENT_TYPES.map((type) => type.key) as [DocumentType, ...DocumentType[]];

export function documentTypeLabel(key: string | null | undefined) {
  return DOCUMENT_TYPES.find((type) => type.key === key)?.label ?? "Não identificado";
}

/** Qualifiers that tell two values of the same field apart (a price per age band, per region...). */
export const QUALIFIER_KEYS = [
  "faixa_etaria",
  "acomodacao",
  "coparticipacao",
  "vidas",
  "regiao",
  "cidade",
  "bairro",
  "procedimento",
  "contratacao",
  "parcela",
  "condicao",
] as const;
export type QualifierKey = (typeof QUALIFIER_KEYS)[number];

/** Lowercase, no accents, words joined by "_": the stable form of names and keys. */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Name used to match operators and plans: "Amil S380 QC" and "AMIL s 380 qc" are the same. */
export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * ANS age bands ("0-18", "19-23" ... "59+"). Accepts "00 a 18", "0 - 18 anos",
 * "59 ou mais", "acima de 59"; anything else is kept as written (slugified).
 */
export function normalizeAgeBand(value: string) {
  const text = value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const open = text.match(/(\d{1,3})\s*(\+|anos? ou mais|ou mais|em diante|acima)/) ?? text.match(/(acima de|a partir de|mais de)\s*(\d{1,3})/);
  if (open) {
    const age = Number(open[1]?.match(/\d/) ? open[1] : open[2]);
    if (Number.isFinite(age)) return `${age}+`;
  }
  const range = text.match(/(\d{1,3})\s*(?:-|a|ate|até|–)\s*(\d{1,3})/);
  if (range) return `${Number(range[1])}-${Number(range[2])}`;
  return slugify(value);
}

function normalizeQualifier(key: string, value: string) {
  if (key === "faixa_etaria") return normalizeAgeBand(value);
  return slugify(value);
}

/** Qualifiers in a stable form and order: the part of the fact key that tells values apart. */
export function canonicalQualifiers(qualifiers: Record<string, string | null | undefined> | null | undefined) {
  const entries = Object.entries(qualifiers ?? {})
    .map(([key, value]) => [slugify(key), typeof value === "string" ? value.trim() : ""] as const)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => [key, normalizeQualifier(key, value)] as const)
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries) as Record<string, string>;
}

/**
 * Identity of a piece of information. Two materials saying the same thing about
 * the same operator, plan, area, field and conditions share it, so the newer one
 * updates the older one instead of adding a copy.
 */
export function buildFactKey(input: {
  carrierId: string;
  planId: string | null;
  areaSlug: string;
  fieldKey: string;
  qualifiers: Record<string, string>;
  /** Network entries are many values of one field: the value itself is part of the identity. */
  value?: string;
}) {
  const qualifierPart = Object.entries(input.qualifiers).map(([key, value]) => `${key}=${value}`).join(";");
  const valuePart = input.areaSlug === "rede_credenciada" && input.value ? `|${normalizeName(input.value)}` : "";
  return `${input.carrierId}|${input.planId ?? "*"}|${input.areaSlug}|${input.fieldKey}|${qualifierPart}${valuePart}`;
}

export type ResolvedArea = CatalogArea & { custom?: boolean };

/** System areas plus the director's approved areas and fields. */
export function mergeAreas(custom: Array<{ slug: string; label: string; description: string | null; fields: unknown }>): ResolvedArea[] {
  const fieldsOf = (value: unknown): CatalogField[] =>
    Array.isArray(value)
      ? value.flatMap((field) =>
        field && typeof field === "object" && typeof (field as CatalogField).key === "string" && typeof (field as CatalogField).label === "string"
          ? [{ key: (field as CatalogField).key, label: (field as CatalogField).label, type: (field as CatalogField).type ?? "text" }]
          : [])
      : [];
  const bySlug = new Map<string, ResolvedArea>(SYSTEM_AREAS.map((area) => [area.slug, { ...area, fields: [...area.fields] }]));
  for (const row of custom) {
    const existing = bySlug.get(row.slug);
    const extra = fieldsOf(row.fields);
    if (existing) {
      const known = new Set(existing.fields.map((field) => field.key));
      existing.fields.push(...extra.filter((field) => !known.has(field.key)));
    } else {
      bySlug.set(row.slug, { slug: row.slug, label: row.label, description: row.description ?? "", fields: extra, custom: true });
    }
  }
  return [...bySlug.values()];
}

/** Number inside a value like "R$ 1.234,56", "12,5%" or "30 dias"; null when there is none. */
export function parseNumericValue(value: string): number | null {
  const match = value.replace(/\s/g, "").match(/-?\d[\d.]*(,\d+)?|-?\d+(\.\d+)?/);
  if (!match) return null;
  let raw = match[0];
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}
