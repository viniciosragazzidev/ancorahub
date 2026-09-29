import type { TenantRole } from "@/shared/db/schema";
import type { CustomRoleScope } from "@/features/custom-roles/catalog";

export const tenantRoles = ["director", "manager", "supervisor", "broker"] as const;

export type TenantContext = {
  userId: string;
  tenantId: string;
  /** Papel de segurança — determina as permissões base (director | manager | broker) */
  role: TenantRole;
  /** Cargo exibido — função descritiva (director | manager | broker | marketing | finance | operations | support) */
  jobTitle: string;
  customRoleId?: string | null;
  /** Escopo do cargo personalizado, sempre resolvido no servidor. */
  customRoleScope?: CustomRoleScope | null;
  /** Escopo de filial — null para diretores e marketing central */
  branchId: string | null;
};

export type ScopeProvenance =
  | "TENANT_WIDE"
  | "TENANT_MANAGER_BRANCHES"
  | "LEGACY_MEMBERSHIP_BRANCH"
  | "CUSTOM_ROLE_SCOPE"
  | "SELF_BROKER"
  | "NONE"
  | "EMPTY_FALLBACK";

export type ResourceOwnershipScope = "ANY" | "SCOPED" | "SELF" | "NONE";

export type AccessScopeType = "GLOBAL" | "UNITS" | "SELF" | "NONE";

export interface AccessScope {
  /** True se o usuário possui abrangência completa no tenant (ex: Diretor) */
  tenantWide: boolean;
  /** IDs de unidades/filiais autorizadas para este usuário */
  unitIds: readonly string[];
  /** IDs de equipes autorizadas para este usuário (se aplicável) */
  teamIds: readonly string[];
  /** Modo de posse/titularidade de recursos */
  ownership: ResourceOwnershipScope;
  /** Proveniência de auditoria indicando a origem da resolução do escopo */
  provenance: {
    units: ScopeProvenance;
    teams?: ScopeProvenance;
  };
}

export interface ResourceScopeDescriptor {
  /** Tenant ao qual o recurso pertence (obrigatório para isolamento) */
  tenantId: string;
  /** ID da unidade/filial associada ao recurso (se houver) */
  unitId?: string | null;
  /** ID da equipe associada ao recurso (se houver) */
  teamId?: string | null;
  /** ID do usuário proprietário/responsável pelo recurso (se houver) */
  ownerUserId?: string | null;
}

export type AuthorizationDenyReason =
  | "MISSING_CAPABILITY"
  | "TENANT_MISMATCH"
  | "UNIT_OUT_OF_SCOPE"
  | "TEAM_OUT_OF_SCOPE"
  | "NOT_RESOURCE_OWNER"
  | "SCOPE_EMPTY"
  | "INVALID_CONTEXT";

export interface AuthorizationDecision {
  /** Decisão final de autorização */
  allowed: boolean;
  /** Capacidade avaliada */
  capability?: string;
  /** Motivo de recusa caso allowed seja false */
  reason?: AuthorizationDenyReason;
  /** Detalhe explicativo não sensível */
  details?: string;
  /** Nível de escopo que satisfez a autorização */
  matchedScope?: "TENANT_WIDE" | "UNIT" | "TEAM" | "SELF" | "NONE";
}

export interface QueryScopeConstraints {
  tenantId: string;
  tenantWide: boolean;
  allowedUnitIds: readonly string[];
  allowedTeamIds: readonly string[];
  ownerMode: ResourceOwnershipScope;
  effectiveOwnerUserId?: string;
}

export type PlatformAdminContext = {
  userId: string;
  email: string;
};

