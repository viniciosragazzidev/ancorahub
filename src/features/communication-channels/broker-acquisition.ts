/**
 * Aquisição de corretores (Vinicios, 24/11): quem entra no WhatsApp com a mensagem pronta do
 * anúncio de parceria ("Sou corretor(a) e quero conhecer a parceria da Âncora.") é um corretor
 * querendo parceria, não um cliente. Vira lead na fila "Aquisição Corretores", sem a IA de
 * qualificação, mesmo quando a campanha está com a captura desligada. Só vale para a primeira
 * mensagem de um contato novo; os outros contatos seguem a entrada normal do número.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { isBrokerPartnershipMessage } from "./broker-acquisition-message";

export { isBrokerPartnershipMessage };

export const BROKER_ACQUISITION_QUEUE_SLUG = "aquisicao-corretores";
export const BROKER_ACQUISITION_QUEUE_NAME = "Aquisição Corretores";

/** The queue, created once for the tenant (no unit, no AI); the director sets brokers and rules like any queue. */
export async function ensureBrokerAcquisitionQueue(tenantId: string) {
  const db = getDatabase();
  const find = async () => {
    const [existing] = await db.select({ id: schema.leadQueues.id })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.slug, BROKER_ACQUISITION_QUEUE_SLUG), isNull(schema.leadQueues.deletedAt)))
      .limit(1);
    return existing?.id ?? null;
  };
  const existing = await find();
  if (existing) return existing;
  const now = new Date();
  await db.insert(schema.leadQueues).values({
    id: randomUUID(),
    tenantId,
    branchId: null,
    name: BROKER_ACQUISITION_QUEUE_NAME,
    slug: BROKER_ACQUISITION_QUEUE_SLUG,
    aiQualificationEnabled: false,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  const created = await find();
  if (!created) throw new Error("Fila Aquisição Corretores não pôde ser criada.");
  return created;
}
