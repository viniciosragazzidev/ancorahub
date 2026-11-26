import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { getSystemSettings } from "./queries";
import { buildResourceEntries, groupResources, resourceSettingKeys, type ResourceGroup } from "./resource-catalog";

/**
 * Recursos da corretora para /settings (25/11), só leitura. Diretor: empresa inteira e "Ajustar" no que ele decide.
 * Gestor: a própria unidade, sem "Ajustar". Só a situação (ligado ou desligado) sai daqui, nunca o valor salvo.
 */
export async function getTenantResourceGroups(context: TenantContext): Promise<ResourceGroup[]> {
  const director = context.role === "director";
  const db = getDatabase();
  const [settings, [company], units] = await Promise.all([
    getSystemSettings(resourceSettingKeys(context.tenantId)).catch(() => []),
    db.select({
      feedbackToastEnabled: schema.tenants.feedbackToastEnabled,
      feedbackPushEnabled: schema.tenants.feedbackPushEnabled,
      feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled,
    }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    director || context.branchId
      ? db.select({ id: schema.branches.id, name: schema.branches.name, acceptingLeads: schema.branches.acceptingLeads, autoDistribute: schema.branches.autoDistribute })
        .from(schema.branches)
        .where(and(
          eq(schema.branches.tenantId, context.tenantId),
          eq(schema.branches.status, "active"),
          director ? undefined : eq(schema.branches.id, context.branchId!),
        ))
        .orderBy(asc(schema.branches.name))
      : Promise.resolve([]),
  ]);
  const entries = buildResourceEntries({
    tenantId: context.tenantId,
    settings: new Map(settings.map((setting) => [setting.key, setting.value])),
    company: company ? { feedbackToastEnabled: company.feedbackToastEnabled ?? true, feedbackPushEnabled: company.feedbackPushEnabled ?? true, feedbackRequiredEnabled: company.feedbackRequiredEnabled ?? true } : null,
    units,
  });
  return groupResources(entries, { canAdjust: director });
}
