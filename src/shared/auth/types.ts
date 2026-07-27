import type { TenantRole } from "@/shared/db/schema";

export const tenantRoles = ["director", "manager", "broker"] as const;

export type TenantContext = {
  userId: string;
  tenantId: string;
  /** Papel de segurança — determina as permissões base (director | manager | broker) */
  role: TenantRole;
  /** Cargo exibido — função descritiva (director | manager | broker | marketing | finance | operations | support) */
  jobTitle: string;
  /** Escopo de filial — null para diretores e marketing central */
  branchId: string | null;
};

export type PlatformAdminContext = {
  userId: string;
  email: string;
};
