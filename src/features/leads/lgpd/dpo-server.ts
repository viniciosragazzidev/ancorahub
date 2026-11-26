import "server-only";

import { eq } from "drizzle-orm";

import { publicFormConfig } from "@/features/public-form/intake";
import { hashWebhookToken } from "@/features/leads/webhooks/utils/lead-webhook.utils";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { dpoKey, parseDpo, type DataProtectionOfficer } from "./dpo";

/** O encarregado da empresa (cache de system_settings). Sem leitura, nada: o rodapé some em vez de quebrar. */
export async function getDpo(tenantId: string): Promise<DataProtectionOfficer | null> {
  try {
    return parseDpo(await getSystemSetting(dpoKey(tenantId)));
  } catch {
    return null;
  }
}

/**
 * O encarregado das páginas públicas (/formulario e /termos): a empresa dona da fonte de captura do
 * formulário (FORMULARIO_WEBHOOK_TOKEN no Coolify), a mesma que recebe os leads de lá.
 */
export async function getPublicDpo(): Promise<DataProtectionOfficer | null> {
  const config = publicFormConfig();
  if (!config) return null;
  try {
    const [credential] = await getDatabase()
      .select({ tenantId: schema.leadWebhookCredentials.tenantId })
      .from(schema.leadWebhookCredentials)
      .where(eq(schema.leadWebhookCredentials.tokenHash, hashWebhookToken(config.token)))
      .limit(1);
    return credential ? await getDpo(credential.tenantId) : null;
  } catch {
    return null;
  }
}
