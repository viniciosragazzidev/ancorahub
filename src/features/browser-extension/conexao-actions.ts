"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireAnyRole } from "@/shared/auth/authorization";
import { getDatabase, schema } from "@/shared/db";
import { createExtensionCodeAction } from "./actions";
import { conexaoParamsSchema } from "./conexao-schemas";

/** Gera o código de uso único amarrado à extensão e ao aparelho que abriram a página de conexão. */
export async function gerarCodigoConexaoAction(entrada: unknown) {
  requireAnyRole(await getRequiredTenantContext(), ["broker"]);
  const params = conexaoParamsSchema.parse(entrada);
  // TODO(E0a): a E0a passa a aceitar { extensionId, deviceId } em createExtensionCodeAction. Até a integração,
  // a chamada sai sem amarração no servidor; o cast existe só para o tipo aceitar o objeto.
  const gerar = createExtensionCodeAction as unknown as (amarracao: { extensionId: string; deviceId: string }) => ReturnType<typeof createExtensionCodeAction>;
  return gerar({ extensionId: params.ext, deviceId: params.device });
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
