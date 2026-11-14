export const distributionViewValues = [
  "resumo_dia",
  "roteamento",
  "filas",
  "plantao",
  "saude_historico",
] as const;

export type DistributionView = (typeof distributionViewValues)[number];

/** Capacidade de cada aba para quem tem cargo (04/11, F2). Sem cargo, vale só o papel, como antes. */
export const DISTRIBUTION_VIEW_CAPABILITY: Record<DistributionView, string> = {
  resumo_dia: "lead_queues_view",
  roteamento: "distribution_settings_manage",
  filas: "lead_queues_view",
  plantao: "duty_schedules_manage",
  saude_historico: "distribution_audit_view",
};

/** `cargoCapabilities`: só para quem tem cargo (papel ∩ cargo); `undefined` mantém a regra do papel. */
export function visibleDistributionViews(role: string, cargoCapabilities?: ReadonlySet<string>): readonly DistributionView[] {
  const porPapel = role === "director"
    ? distributionViewValues
    : distributionViewValues.filter((view) => view !== "filas");
  if (!cargoCapabilities) return porPapel;
  return porPapel.filter((view) => cargoCapabilities.has(DISTRIBUTION_VIEW_CAPABILITY[view]));
}

export function resolveDistributionView(role: string, requestedView?: string, cargoCapabilities?: ReadonlySet<string>): DistributionView | null {
  const aliases: Record<string, DistributionView> = {
    resumo: "resumo_dia",
    saude: "saude_historico",
    historico: "saude_historico",
    // A aba Operação saiu (14/11/2026): a atribuição manual mora no Resumo.
    operar: "resumo_dia",
  };
  const normalized = requestedView ? aliases[requestedView] ?? requestedView : "resumo_dia";
  const allowed = visibleDistributionViews(role, cargoCapabilities);
  if (allowed.includes(normalized as DistributionView)) return normalized as DistributionView;
  // Cargo sem o Resumo cai na primeira aba liberada; sem nenhuma, a página nega.
  return allowed.includes("resumo_dia") ? "resumo_dia" : allowed[0] ?? null;
}
