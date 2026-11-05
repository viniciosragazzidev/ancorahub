import "server-only";

import { hasEffectiveCapability } from "@/features/custom-roles/service";
import type { TenantContext } from "@/shared/auth/tenant-context";
import { canExportBrokerLeadsByPermission } from "./broker-lead-export";

export async function canExportBrokerLeads(context: Pick<TenantContext, "tenantId" | "role" | "jobTitle" | "customRoleId">) {
  if (context.role !== "director" && context.role !== "manager") return false;
  const effectiveContext = { ...context, customRoleId: context.customRoleId ?? null };
  const [canExportOperationalReports, canAccessLeads] = await Promise.all([
    hasEffectiveCapability({ ...effectiveContext, permission: "exportar_relatorios_operacionais" }),
    hasEffectiveCapability({ ...effectiveContext, permission: "acessar_leads" }),
  ]);
  return canExportBrokerLeadsByPermission({
    role: context.role,
    canExportOperationalReports,
    canAccessLeads,
  });
}
