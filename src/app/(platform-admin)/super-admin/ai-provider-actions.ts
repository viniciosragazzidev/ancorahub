"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { credentialBadge, providerCheckSettingKey, type CredentialBadge } from "@/features/ai-gateway/admin-overview";
import { checkProviderCredential } from "@/features/ai-gateway/admin-panel-data";
import { providerKey } from "@/features/ai-gateway/gateway";
import { PROVIDERS } from "@/features/ai-gateway/profiles";
import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

export type TestAiProviderResult = { ok: true; badge: CredentialBadge; checkedAt: string } | { ok: false; reason: string };

/** "Testar agora" (Super-admin › IA): chamada mínima ao provedor, sem gastar token. Guarda só o resultado e os 4 últimos. */
export async function testAiProviderAction(providerInput: string): Promise<TestAiProviderResult> {
  const admin = await getRequiredPlatformAdmin();
  const provider = z.enum(PROVIDERS).parse(providerInput);
  const now = new Date();
  const check = await checkProviderCredential(provider, now);
  if (!check) return { ok: false, reason: "Este provedor não tem chave salva." };
  await setSystemSetting(providerCheckSettingKey(provider), JSON.stringify(check), now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId,
    action: "ai_provider.credential_tested",
    targetType: "system_settings", targetId: providerCheckSettingKey(provider),
    metadata: { provider, ok: check.ok, cause: check.cause ?? null }, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  const key = await providerKey(provider);
  // O teste em si deu certo mesmo quando a chave falhou: o selo traz a causa.
  return { ok: true, badge: credentialBadge({ key: key ?? null, check }), checkedAt: check.at };
}
