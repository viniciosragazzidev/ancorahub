import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { getDatabase, schema } from "@/shared/db";
import { getPlatformTenants } from "@/features/platform-admin/service";
import { and, eq, isNull } from "drizzle-orm";
import { WhatsAppAdminPanel } from "./whatsapp-admin-panel";

export default async function SuperAdminWhatsAppIntegrationsPage() {
  const tenants = await getPlatformTenants();
  const db = getDatabase();
  const connections = await db.select({
    id: schema.communicationChannels.id,
    tenantId: schema.communicationChannels.tenantId,
    displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
    verifiedName: schema.communicationChannels.verifiedName,
    status: schema.communicationChannels.status,
    qualityRating: schema.communicationChannels.qualityRating,
    lastWebhookAt: schema.communicationChannels.lastWebhookAt,
  }).from(schema.communicationChannels)
    .where(and(eq(schema.communicationChannels.provider, "meta_cloud"), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true)));

  return <>
    <PlatformAdminHeader breadcrumb="CorreTop / Admin / Integrações" title="WhatsApp Oficial" />
    <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div><p className="text-xs font-medium text-primary">INTEGRAÇÕES</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Gestão de canais WhatsApp</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">A configuração técnica da Meta fica centralizada no Super Admin. Cada empresa recebe um único canal oficial, validado antes de ser salvo.</p></div>
      <WhatsAppAdminPanel tenants={tenants.map((tenant) => ({ id: tenant.id, name: tenant.name, status: tenant.status }))} connections={connections} />
    </main>
  </>;
}
