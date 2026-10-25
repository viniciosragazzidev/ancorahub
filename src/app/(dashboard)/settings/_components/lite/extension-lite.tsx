/**
 * "Extensão para o WhatsApp Web" no visual Lite. Mesma consulta e mesma regra de quem configura a empresa da aba atual
 * (`canConfigure` = papel diretor, como hoje); mesma Server Action para habilitar ou desativar.
 */
import { eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { ExtensionLiteView, type ExtensionLiteData } from "./extension-lite-view";

export async function loadExtensionLiteData(): Promise<ExtensionLiteData> {
  const context = await getRequiredTenantContext();
  const [settings] = await getDatabase()
    .select({ enabled: schema.extensionSettings.enabled, minimumVersion: schema.extensionSettings.minimumVersion })
    .from(schema.extensionSettings)
    .where(eq(schema.extensionSettings.tenantId, context.tenantId))
    .limit(1);
  // Mesma regra da tela atual: só o papel diretor liga ou desliga a extensão para a empresa.
  return { enabled: Boolean(settings?.enabled), minimumVersion: settings?.minimumVersion ?? "0.1.0", canConfigure: context.role === "director" };
}

export async function ExtensionLite() {
  return <ExtensionLiteView data={await loadExtensionLiteData()} />;
}
