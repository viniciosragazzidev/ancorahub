import "server-only";

import { randomUUID } from "node:crypto";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { createMetaConnectionAttempt } from "./meta-connection-attempts";

export async function startMetaMarketingConnection() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") {
    throw new Error("Apenas Diretores podem conectar Marketing da Meta.");
  }

  const attempt = await createMetaConnectionAttempt({
    tenantId: context.tenantId,
    userId: context.userId,
    product: "marketing",
  });

  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "meta_connection_attempt",
    entidadeId: attempt.id,
    acao: "meta_marketing_connection_started",
    createdAt: new Date(),
  });

  return attempt;
}
