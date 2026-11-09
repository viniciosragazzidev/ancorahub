import "server-only";

import type { TenantContext } from "@/shared/auth/tenant-context";
import { getSupervisedBrokerIds } from "@/features/team/supervisor-service";

/**
 * Corretores cujo perfil (/equipe/[id]) o supervisor pode abrir: os da equipe dele (tenant_memberships.supervisor_id).
 * Sem o escopo de equipe ligado o perfil nega tudo, então a lista vem vazia. Outros papéis: null (não se aplica).
 */
export async function getBrokerProfileTeamIds(context: Pick<TenantContext, "role" | "tenantId" | "userId" | "supervisorTeamScope">): Promise<string[] | null> {
  if (context.role !== "supervisor") return null;
  if (!context.supervisorTeamScope) return [];
  return getSupervisedBrokerIds(context.tenantId, context.userId).catch(() => []);
}
