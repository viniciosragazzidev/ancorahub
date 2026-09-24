export type MetaLeadDisplayDetails = {
  tipoPlano: string | null;
  tipoPlanoStatus: "provided" | "not_provided" | null;
  tipoCnpj: string | null;
  operadora: string | null;
};

function readShortText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

export function readMetaLeadDisplayDetails(sourceChannel: string | null | undefined, value: unknown): MetaLeadDisplayDetails {
  if (sourceChannel !== "meta_lead_ads" || !value || typeof value !== "object" || Array.isArray(value)) {
    return { tipoPlano: null, tipoPlanoStatus: null, tipoCnpj: null, operadora: null };
  }

  const metadata = value as Record<string, unknown>;
  const status = metadata.tipoPlanoStatus === "provided" || metadata.tipoPlanoStatus === "not_provided"
    ? metadata.tipoPlanoStatus
    : null;

  return {
    tipoPlano: readShortText(metadata.tipoPlano),
    tipoPlanoStatus: status,
    tipoCnpj: readShortText(metadata.tipoCnpj),
    operadora: readShortText(metadata.operadora),
  };
}

export function getLeadProductLabel(input: {
  tipo: string;
  sourceChannel?: string | null;
  sourceMetadata?: unknown;
}): string {
  const metaDetails = readMetaLeadDisplayDetails(input.sourceChannel, input.sourceMetadata);
  if (metaDetails.tipoPlano) return metaDetails.tipoPlano;
  if (metaDetails.tipoPlanoStatus === "not_provided") return "Não informado";
  return input.tipo || "Não informado";
}
