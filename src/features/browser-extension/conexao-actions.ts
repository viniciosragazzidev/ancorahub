"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireAnyRole } from "@/shared/auth/authorization";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { createExtensionCodeAction } from "./actions";
import { recordExtensionAudit } from "./audit";
import { conexaoParamsSchema } from "./conexao-schemas";
import { isExtensionPilotUser } from "./pilot";

/** Gera o código de uso único amarrado à extensão e ao aparelho que abriram a página de conexão. */
export async function gerarCodigoConexaoAction(entrada: unknown) {
  const context = requireAnyRole(await getRequiredTenantContext(), ["broker"]);
  if (!await isExtensionPilotUser(context.userId)) throw new AuthorizationError("Extensão desativada.");
  const params = conexaoParamsSchema.parse(entrada);
  return createExtensionCodeAction({ extensionId: params.ext, deviceId: params.device });
}

/**
 * Desconecta do lado do CRM: revoga as sessões deste usuário nesta empresa e audita cada aparelho.
 * Tudo numa transação: se a auditoria falhar, nenhuma sessão fica revogada sem registro.
 * Os dados de auditoria vêm do RETURNING do banco, não da entrada.
 */
export async function desconectarExtensaoAction() {
  const context = requireAnyRole(await getRequiredTenantContext(), ["broker", "manager", "director"]);
  await getDatabase().transaction(async (tx) => {
    const revogadas = await tx
      .update(schema.extensionSessions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(schema.extensionSessions.userId, context.userId),
        eq(schema.extensionSessions.tenantId, context.tenantId),
        isNull(schema.extensionSessions.revokedAt),
      ))
      .returning({
        id: schema.extensionSessions.id,
        userId: schema.extensionSessions.userId,
        tenantId: schema.extensionSessions.tenantId,
        deviceId: schema.extensionSessions.deviceId,
        extensionVersion: schema.extensionSessions.extensionVersion,
      });
    for (const sessao of revogadas) {
      await recordExtensionAudit("extension.session.revoked", sessao, {}, tx);
    }
  });
}
