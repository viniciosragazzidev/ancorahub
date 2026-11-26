import "server-only";

import { eq } from "drizzle-orm";

import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { buildInternalDirectory, classifyInternalContact, parseInternalNumbers, type InternalDecision, type InternalDirectory, type InternalNumber } from "./decision";

/** Lista "Números internos" do diretor, por empresa, em system settings (sem migração). */
export function internalNumbersKey(tenantId: string) {
  return `internal_contact_numbers_${tenantId}`;
}

export async function getInternalNumbers(tenantId: string): Promise<InternalNumber[]> {
  return parseInternalNumbers(await getSystemSetting(internalNumbersKey(tenantId)).catch(() => null));
}

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: Promise<InternalDirectory> }>();

/** Equipe ativa (telefone do perfil, sem desligados) e a lista do diretor. Cache curto: o webhook pergunta a cada mensagem. */
export function getInternalDirectory(tenantId: string, now = Date.now()): Promise<InternalDirectory> {
  const hit = cache.get(tenantId);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const value = (async () => {
    const [team, list] = await Promise.all([
      getDatabase()
        .select({ phone: schema.brokerProfiles.phone, name: schema.brokerProfiles.professionalName, deactivatedAt: schema.brokerProfiles.deactivatedAt })
        .from(schema.brokerProfiles)
        .where(eq(schema.brokerProfiles.tenantId, tenantId)),
      getInternalNumbers(tenantId),
    ]);
    return buildInternalDirectory({ team: team.filter((member) => !member.deactivatedAt), list });
  })();
  value.catch(() => {
    if (cache.get(tenantId)?.value === value) cache.delete(tenantId);
  });
  cache.set(tenantId, { at: now, value });
  return value;
}

export function invalidateInternalDirectory(tenantId: string) {
  cache.delete(tenantId);
}

/**
 * É interno? Se a consulta falhar, responde "não": na dúvida a mensagem segue o caminho de sempre e nenhum lead se perde.
 */
export async function checkInternalContact(tenantId: string, phone: string | null | undefined): Promise<InternalDecision> {
  try {
    return classifyInternalContact(phone, await getInternalDirectory(tenantId));
  } catch (error) {
    console.warn("[internal-contacts] check_failed", { tenantId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { internal: false };
  }
}
