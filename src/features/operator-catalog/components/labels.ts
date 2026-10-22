import { documentTypeLabel } from "../taxonomy";

export { documentTypeLabel };

export type AreaInfo = { slug: string; label: string; description: string; fields: Array<{ key: string; label: string }>; custom: boolean; reviewRequired: boolean };

export const MATERIAL_STATUS: Record<string, { label: string; variant: "secondary" | "info" | "success" | "warning" | "destructive" }> = {
  pending: { label: "Na fila", variant: "secondary" },
  processing: { label: "Lendo", variant: "info" },
  cataloged: { label: "Catalogado", variant: "success" },
  needs_review: { label: "Aguardando revisão", variant: "warning" },
  failed: { label: "Falhou", variant: "destructive" },
  skipped: { label: "Sem conteúdo", variant: "secondary" },
};

export function materialStatus(status: string) {
  return MATERIAL_STATUS[status] ?? MATERIAL_STATUS.pending!;
}

export function areaLabel(areas: AreaInfo[], slug: string) {
  return areas.find((area) => area.slug === slug)?.label ?? slug.replace(/_/g, " ");
}

export function fieldLabel(areas: AreaInfo[], areaSlug: string, fieldKey: string) {
  return areas.find((area) => area.slug === areaSlug)?.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey.replace(/_/g, " ");
}

const QUALIFIER_LABEL: Record<string, string> = {
  faixa_etaria: "Faixa",
  acomodacao: "Acomodação",
  coparticipacao: "Copart.",
  vidas: "Vidas",
  regiao: "Região",
  cidade: "Cidade",
  bairro: "Bairro",
  procedimento: "Procedimento",
  contratacao: "Contratação",
  parcela: "Parcela",
  condicao: "Condição",
};

export function qualifiersText(qualifiers: Record<string, string>) {
  return Object.entries(qualifiers)
    .map(([key, value]) => `${QUALIFIER_LABEL[key] ?? key.replace(/_/g, " ")}: ${value.replace(/_/g, " ")}`)
    .join(" · ");
}

export function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function validityText(validFrom: string | null, validUntil: string | null) {
  if (validFrom && validUntil) return `${formatDate(validFrom)} a ${formatDate(validUntil)}`;
  if (validUntil) return `até ${formatDate(validUntil)}`;
  if (validFrom) return `desde ${formatDate(validFrom)}`;
  return "Sem vigência informada";
}
