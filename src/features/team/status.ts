export type TeamMemberStatus = "pending" | "active" | "disabled";

export const teamMemberStatusLabels: Record<TeamMemberStatus, string> = {
  active: "Ativo",
  pending: "Pendente",
  disabled: "Desativado",
};

/**
 * Converts values coming from legacy membership/profile records to the one
 * status contract used by the team UI. Unknown and inactive values are
 * intentionally treated as disabled instead of leaking database values.
 */
export function normalizeTeamMemberStatus(value: string | null | undefined): TeamMemberStatus {
  if (value === "active") return "active";
  if (value === "pending") return "pending";
  return "disabled";
}
