import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "@/shared/db";

export type ExtensionAuditIdentity = {
  id: string; userId: string; tenantId: string; deviceId: string; extensionVersion: string;
};

export function extensionAuditMetadata(session: ExtensionAuditIdentity) {
  return { source: "extension", tenantId: session.tenantId, deviceId: session.deviceId,
    sessionId: session.id, extensionVersion: session.extensionVersion };
}

export async function recordExtensionAudit(
  action: `extension.${string}`, session: ExtensionAuditIdentity,
  detail: { leadId?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
  writer: Pick<ReturnType<typeof getDatabase>, "insert"> = getDatabase(),
) {
  await writer.insert(schema.auditLogs).values({ id: randomUUID(), userId: session.userId,
    entidade: detail.leadId ? "lead" : "browser_extension", entidadeId: detail.leadId ?? detail.entityId ?? session.id,
    acao: action, metadata: { ...detail.metadata, ...extensionAuditMetadata(session) } });
}
