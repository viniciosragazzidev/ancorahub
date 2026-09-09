export const distributionViewValues = [
  "roteamento",
  "resumo_dia",
  "filas",
  "operar",
  "plantao",
  "saude_historico",
] as const;

export type DistributionView = (typeof distributionViewValues)[number];

export function visibleDistributionViews(role: string): readonly DistributionView[] {
  return role === "director"
    ? distributionViewValues
    : distributionViewValues.filter((view) => view !== "filas");
}

export function resolveDistributionView(role: string, requestedView?: string): DistributionView {
  const aliases: Record<string, DistributionView> = {
    resumo: "resumo_dia",
    saude: "saude_historico",
    historico: "saude_historico",
  };
  const normalized = requestedView ? aliases[requestedView] ?? requestedView : "roteamento";
  const allowed = visibleDistributionViews(role);
  return allowed.includes(normalized as DistributionView) ? (normalized as DistributionView) : "roteamento";
}
