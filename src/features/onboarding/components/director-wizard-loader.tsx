import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { DirectorWizard } from "./director-wizard";

export async function DirectorWizardLoader() {
  let context;
  try {
    context = await getRequiredTenantContext();
  } catch {
    return null;
  }

  if (context.role !== "director") return null;

  const db = getDatabase();

  const [tenant] = await db
    .select({
      name: schema.tenants.name,
      logoUrl: schema.tenants.logoUrl,
      initialSetupCompletedAt: schema.tenants.initialSetupCompletedAt,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, context.tenantId))
    .limit(1);

  if (!tenant) return null;
  if (tenant.initialSetupCompletedAt) return null;

  return (
    <DirectorWizard
      tenantName={tenant.name}
      logoUrl={tenant.logoUrl}
    />
  );
}
