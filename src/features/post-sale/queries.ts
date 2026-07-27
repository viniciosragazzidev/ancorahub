import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export async function getLeadBeneficiaries(leadId: string) {
  const context = await getRequiredTenantContext();
  return getDatabase().select({ id: schema.leadBeneficiaries.id, name: schema.leadBeneficiaries.name, birthDate: schema.leadBeneficiaries.birthDate, relationship: schema.leadBeneficiaries.relationship, isHolder: schema.leadBeneficiaries.isHolder }).from(schema.leadBeneficiaries).where(and(eq(schema.leadBeneficiaries.leadId, leadId), eq(schema.leadBeneficiaries.tenantId, context.tenantId), context.role === "broker" ? eq(schema.leads.corretorId, context.userId) : context.role === "manager" ? eq(schema.leads.branchId, context.branchId ?? "") : undefined)).innerJoin(schema.leads, eq(schema.leadBeneficiaries.leadId, schema.leads.id)).orderBy(desc(schema.leadBeneficiaries.isHolder), asc(schema.leadBeneficiaries.name));
}

export async function getPostSaleSettings() {
  const context = await getRequiredTenantContext();
  const [settings] = await getDatabase().select({ chargebackWindowDays: schema.postSaleSettings.chargebackWindowDays, active: schema.postSaleSettings.active }).from(schema.postSaleSettings).where(eq(schema.postSaleSettings.tenantId, context.tenantId)).limit(1);
  return settings ?? { chargebackWindowDays: 90, active: true };
}
