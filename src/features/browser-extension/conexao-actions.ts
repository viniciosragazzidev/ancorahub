"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireAnyRole } from "@/shared/auth/authorization";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { createExtensionCodeAction } from "./actions";
import { conexaoParamsSchema } from "./conexao-schemas";
import { isExtensionPilotUser } from "./pilot";

/** Gera o código de uso único amarrado à extensão e ao aparelho que abriram a página de conexão. */
export async function gerarCodigoConexaoAction(entrada: unknown) {
  const context = requireAnyRole(await getRequiredTenantContext(), ["broker"]);
  if (!await isExtensionPilotUser(context.userId)) throw new AuthorizationError("Extensão desativada.");
  const params = conexaoParamsSchema.parse(entrada);
  return createExtensionCodeAction({ extensionId: params.ext, deviceId: params.device });
}

/** Desconecta do lado do CRM: revoga todas as sessões de extensão deste usuário nesta empresa. */
export async function desconectarExtensaoAction() {
  const context = requireAnyRole(await getRequiredTenantContext(), ["broker", "manager", "director"]);
  const db = getDatabase();
  await db
    .update(schema.extensionSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(schema.extensionSessions.userId, context.userId),
      eq(schema.extensionSessions.tenantId, context.tenantId),
      isNull(schema.extensionSessions.revokedAt),
    ));
  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    userId: context.userId,
    entidade: "extension_session",
    entidadeId: context.userId,
    acao: "extension.session.revoked_all",
  });
}
