import type { BeneficiaryRelation, ConversationBeneficiary, ConversationMemory } from "./memory";

type RelationshipMention = {
  relation: BeneficiaryRelation;
  text: string;
  start: number;
  end: number;
  plural: boolean;
};

export type BeneficiaryRelationCapture = {
  status: "mapped" | "ambiguous" | "declined" | "unrecognized";
  beneficiaries: ConversationBeneficiary[];
  raw?: string;
  relationAsked: true;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizedTextMap(value: string) {
  let normalized = "";
  const sourceIndex: number[] = [];
  Array.from(value).forEach((character, index) => {
    for (const normalizedCharacter of normalize(character)) {
      normalized += normalizedCharacter;
      sourceIndex.push(index);
    }
  });
  return { normalized, sourceIndex };
}

export function parseAgeValues(value: string | null | undefined) {
  const matches = (value ?? "").match(/\b\d{1,3}\b/g) ?? [];
  return matches.map(Number).filter((age) => Number.isInteger(age) && age >= 0 && age <= 120);
}

function relationshipMentions(value: string): RelationshipMention[] {
  const { normalized, sourceIndex } = normalizedTextMap(value);
  const definitions: Array<{ pattern: RegExp; relation: BeneficiaryRelation; plural?: boolean }> = [
    { pattern: /\b(?:eu mesmo|sou eu|eu|voce)\b/g, relation: "titular" },
    { pattern: /\b(?:esposa|esposo|marido|mulher|companheiro|companheira|conjuge|namorado|namorada)\b/g, relation: "conjuge" },
    { pattern: /\b(?:enteado|enteada|filho|filha|filhos|filhas)\b/g, relation: "filho", plural: true },
    { pattern: /\b(?:pai|mae|pais|sogro|sogra|sogros|sogras)\b/g, relation: "pai_mae" },
    { pattern: /\b(?:neto|neta|netos|netas)\b/g, relation: "neto", plural: true },
    { pattern: /\b(?:irmao|irma|sobrinho|sobrinha|tio|tia|primo|prima|amigo|amiga)\b/g, relation: "outro" },
    { pattern: /\b(?:cunhado|cunhada|afilhado|afilhada|madrasta|padrasto|avo|bisavo|genro|nora)\b/g, relation: "outro" },
  ];
  const mentions: RelationshipMention[] = [];

  for (const definition of definitions) {
    for (const match of normalized.matchAll(definition.pattern)) {
      const normalizedStart = match.index ?? 0;
      const normalizedEnd = normalizedStart + match[0].length;
      const start = sourceIndex[normalizedStart] ?? normalizedStart;
      const end = (sourceIndex[normalizedEnd - 1] ?? normalizedEnd - 1) + 1;
      const prefix = normalized.slice(Math.max(0, normalizedStart - 7), normalizedStart);
      const possessive = /\b(?:meu|minha|meus|minhas|seu|sua|seus|suas|o|a)\s*$/.exec(prefix)?.[0]?.trim();
      const sourceText = Array.from(value).slice(Math.max(0, start - (possessive ? possessive.length + 1 : 0)), end).join("").trim();
      mentions.push({
        relation: definition.relation,
        text: sourceText || Array.from(value).slice(start, end).join(""),
        start,
        end,
        plural: Boolean(definition.plural && /s$/.test(match[0])),
      });
    }
  }

  return mentions.sort((left, right) => left.start - right.start);
}

function declined(value: string) {
  const text = normalize(value).trim().replace(/[.!?]+$/g, "");
  return /^(?:nao|nao obrigado|nao obrigada|pode seguir|prefiro nao (?:falar|informar)|nao quero (?:falar|informar)|nao precisa|deixa(?:r)? pra la|tudo bem,? pode seguir)$/.test(text);
}

function blankBeneficiaries(ages: number[], sourceMessageId?: string): ConversationBeneficiary[] {
  return ages.map((age) => ({ age, relation: null, sourceMessageId }));
}

/**
 * Links relationship words to already captured ages only when the customer makes the mapping
 * explicit by number, or supplies exactly one relationship for each age in the same order.
 */
export function captureBeneficiaryRelations(input: {
  message: string;
  ages: number[];
  planType?: string | null;
  sourceMessageId?: string | null;
  relationAsked?: boolean;
}): BeneficiaryRelationCapture {
  const ages = input.ages;
  const normalizedMessage = normalize(input.message).trim().replace(/[.!?]+$/g, "");
  const mentions = relationshipMentions(input.message);
  const base = blankBeneficiaries(ages, input.sourceMessageId ?? undefined);

  if (declined(input.message)) return { status: "declined", beneficiaries: base, relationAsked: true };
  if (/\b(?:a familia toda|toda a familia|familia inteira|todo mundo|todos nos|todas nos)\b/.test(normalizedMessage) && input.relationAsked) {
    return { status: "ambiguous", beneficiaries: base, raw: input.message, relationAsked: true };
  }
  const unrelatedPlanStatement = /\b(?:ainda nao tem plano|nao tem plano|nao entra no plano|nao vai entrar|nao pretende entrar|nao usa o plano)\b/.test(normalizedMessage);
  if (unrelatedPlanStatement) return { status: "unrecognized", beneficiaries: base, relationAsked: true };
  if (!mentions.length || !ages.length) return { status: "unrecognized", beneficiaries: base, relationAsked: true };

  const claimedAgeIndexes = new Set<number>();
  const ageTokens = [...normalize(input.message).matchAll(/\b\d{1,3}\b/g)].flatMap((match) => {
    const age = Number(match[0]);
    const beneficiaryIndex = ages.findIndex((value, index) => value === age && !claimedAgeIndexes.has(index));
    if (beneficiaryIndex < 0) return [];
    claimedAgeIndexes.add(beneficiaryIndex);
    const start = match.index ?? 0;
    return [{ age, beneficiaryIndex, start, end: start + match[0].length }];
  });

  if (ageTokens.length) {
    const mapped = new Map<number, RelationshipMention>();
    for (const mention of mentions) {
      const normalizedStart = normalize(Array.from(input.message).slice(0, mention.start).join("")).length;
      const normalizedEnd = normalize(Array.from(input.message).slice(0, mention.end).join("")).length;
      const nearest = ageTokens
        .map((token) => ({ token, distance: token.end <= normalizedStart ? normalizedStart - token.end : token.start >= normalizedEnd ? token.start - normalizedEnd : 0 }))
        .sort((left, right) => left.distance - right.distance)[0];
      if (nearest && nearest.distance <= 20 && ages.includes(nearest.token.age)) {
        if (mapped.has(nearest.token.beneficiaryIndex)) return { status: "ambiguous", beneficiaries: base, raw: input.message, relationAsked: true };
        mapped.set(nearest.token.beneficiaryIndex, mention);
      }
    }
    if (mapped.size === ages.length && ages.every((_age, index) => mapped.has(index))) {
      return {
        status: "mapped",
        beneficiaries: base.map((beneficiary, index) => {
          const mention = mapped.get(index)!;
          return {
            ...beneficiary,
            relation: mention.relation === "conjuge" && input.planType === "individual" && /namorad/i.test(normalize(mention.text)) ? "outro" : mention.relation,
            relationText: mention.text,
          };
        }),
        relationAsked: true,
      };
    }
    return { status: "ambiguous", beneficiaries: base, raw: input.message, relationAsked: true };
  }

  if (mentions.length === ages.length && mentions.every((mention) => !mention.plural)) {
    return {
      status: "mapped",
      beneficiaries: base.map((beneficiary, index) => {
        const mention = mentions[index]!;
        return {
          ...beneficiary,
          relation: mention.relation === "conjuge" && input.planType === "individual" && /namorad/i.test(normalize(mention.text)) ? "outro" : mention.relation,
          relationText: mention.text,
        };
      }),
      relationAsked: true,
    };
  }

  if (!ageTokens.length && mentions.length === 1 && !mentions[0]!.plural) {
    return input.relationAsked
      ? { status: "ambiguous", beneficiaries: base, raw: input.message, relationAsked: true }
      : { status: "unrecognized", beneficiaries: base, relationAsked: true };
  }

  return { status: "ambiguous", beneficiaries: base, raw: input.message, relationAsked: true };
}

/** Legacy single free-text relationship has no safe age mapping, so retain it without attaching it to an age. */
export function beneficiariesFromMemory(memory: ConversationMemory, ages: number[]): ConversationBeneficiary[] {
  if (memory.beneficiaries?.length) return memory.beneficiaries;
  if (memory.beneficiaryRelation?.trim()) {
    return [{ age: null, relation: "outro", relationText: memory.beneficiaryRelation.trim() }];
  }
  return blankBeneficiaries(ages);
}
