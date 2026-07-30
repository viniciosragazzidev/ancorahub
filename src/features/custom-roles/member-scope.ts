import type { CustomRoleScope } from "./catalog";

export type TeamJobTitle =
  | "director"
  | "manager"
  | "broker"
  | "marketing"
  | "finance"
  | "operations"
  | "support";

/**
 * System operational profiles always belong to one unit. Administrative
 * positions are tenant-wide by default and become unit-bound only when their
 * custom role explicitly uses the `branch` scope.
 */
export function requiresMemberBranch(input: {
  jobTitle: TeamJobTitle | string;
  customRoleScope?: CustomRoleScope | null;
}) {
  return input.jobTitle === "manager"
    || input.jobTitle === "broker"
    || input.customRoleScope === "branch";
}

export function memberScopeLabel(input: {
  jobTitle: TeamJobTitle | string;
  customRoleScope?: CustomRoleScope | null;
  branchName?: string | null;
}) {
  if (requiresMemberBranch(input)) return input.branchName ?? "Unidade obrigatória";
  return input.branchName ?? "Geral da empresa";
}

export function roleScopeLabel(scope: CustomRoleScope) {
  return {
    none: "Sem operação",
    own: "Atuação individual",
    branch: "Uma unidade",
    tenant: "Geral da empresa",
  }[scope];
}
