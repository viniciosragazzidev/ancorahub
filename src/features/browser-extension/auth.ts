import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError, AuthenticationError } from "@/shared/auth/errors";
import { extensionCodeBindingSchema, type ExtensionCodeBinding, type ExtensionDeviceInput, type ExtensionSession } from "./schemas";
import { recordExtensionAudit } from "./audit";
import { condicaoSessaoAtiva, sessaoAtivaEm, SESSION_MAX_MS } from "./sessao-ativa";

export { SESSION_IDLE_MS, SESSION_MAX_MS } from "./sessao-ativa";
export const SESSION_PERMISSIONS = ["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"];
export const SESSION_TOUCH_MS = 5 * 60_000;
export type ExtensionPrincipal = Omit<typeof schema.extensionSessions.$inferSelect, "permissions"> & { permissions: string[] };
export type ExtensionGrant = typeof schema.extensionAuthCodes.$inferSelect;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// Binding the device in the hash avoids a second new column; legacy manual codes retain their old hash.
const codeHash = (code: string, binding?: ExtensionCodeBinding) => hash(binding
  ? JSON.stringify([code, binding.extensionId, binding.deviceId]) : code);

export async function createExtensionAuthorizationCode(rawBinding?: ExtensionCodeBinding) {
  const binding = rawBinding === undefined ? undefined : extensionCodeBindingSchema.parse(rawBinding);
  const context = await getRequiredTenantContext();
  if (!["broker", "manager", "director"].includes(context.role)) throw new AuthorizationError("Perfil não autorizado para a extensão.");
  const rawCode = randomBytes(32).toString("base64url");
  const now = new Date();
  await getDatabase().insert(schema.extensionAuthCodes).values({
    id: randomUUID(), codeHash: codeHash(rawCode, binding), extensionId: binding?.extensionId ?? null,
    userId: context.userId, tenantId: context.tenantId, expiresAt: new Date(now.getTime() + 5 * 60_000), createdAt: now,
  });
  return rawCode;
}

export async function authenticateExtensionRequest(request: Request): Promise<ExtensionPrincipal> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new AuthenticationError("Sessão da extensão ausente.");
  const now = new Date();
  // The token hash is the initial capability; tenant is taken from this row, never from the request.
  const [session] = await getDatabase().select().from(schema.extensionSessions).where(and(
    eq(schema.extensionSessions.tokenHash, hash(token)), condicaoSessaoAtiva(now),
  )).limit(1);
  if (!session || !sessaoAtivaEm(session, now)) {
    throw new AuthenticationError("Sessão da extensão expirada ou revogada.");
  }
  return { ...session, permissions: Array.isArray(session.permissions)
    ? session.permissions.filter((value): value is string => typeof value === "string") : [] };
}

export async function touchExtensionSession(session: ExtensionPrincipal) {
  const now = new Date();
  if (now.getTime() - (session.lastSeenAt ?? session.createdAt).getTime() <= SESSION_TOUCH_MS) return;
  await getDatabase().update(schema.extensionSessions).set({ lastSeenAt: now }).where(and(
    eq(schema.extensionSessions.id, session.id), eq(schema.extensionSessions.tenantId, session.tenantId),
    eq(schema.extensionSessions.tokenHash, session.tokenHash), isNull(schema.extensionSessions.revokedAt),
    or(isNull(schema.extensionSessions.lastSeenAt), lt(schema.extensionSessions.lastSeenAt, new Date(now.getTime() - SESSION_TOUCH_MS))),
  ));
}

export async function getExtensionExchangePrincipal(input: ExtensionDeviceInput) {
  const now = new Date();
  const legacy = and(eq(schema.extensionAuthCodes.codeHash, codeHash(input.code)), isNull(schema.extensionAuthCodes.extensionId));
  const binding = input.extensionId ? { extensionId: input.extensionId, deviceId: input.deviceId } : undefined;
  const bound = binding ? and(eq(schema.extensionAuthCodes.codeHash, codeHash(input.code, binding)), eq(schema.extensionAuthCodes.extensionId, binding.extensionId)) : undefined;
  const [grant] = await getDatabase().select().from(schema.extensionAuthCodes).where(and(
    bound ? or(legacy, bound) : legacy, isNull(schema.extensionAuthCodes.usedAt), gt(schema.extensionAuthCodes.expiresAt, now),
  )).limit(1);
  if (!grant || grant.usedAt || grant.expiresAt <= now || grant.codeHash !== codeHash(input.code, grant.extensionId ? binding : undefined)
    || (grant.extensionId && grant.extensionId !== input.extensionId)) throw new AuthenticationError("Código inválido ou expirado.");
  const session: ExtensionPrincipal = { id: grant.id, userId: grant.userId, tenantId: grant.tenantId,
    deviceId: input.deviceId, extensionVersion: input.extensionVersion, tokenHash: "", permissions: [...SESSION_PERMISSIONS],
    expiresAt: grant.expiresAt, createdAt: grant.createdAt, lastSeenAt: now, revokedAt: null };
  return { session, grant };
}

export async function exchangeExtensionCode(input: ExtensionDeviceInput, grant: ExtensionGrant) {
  const now = new Date();
  const rawToken = randomBytes(48).toString("base64url");
  const sessionId = randomUUID();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_MS);
  const session = { id: sessionId, userId: grant.userId, tenantId: grant.tenantId, deviceId: input.deviceId,
    extensionVersion: input.extensionVersion, permissions: [...SESSION_PERMISSIONS], expiresAt, lastSeenAt: now, createdAt: now };
  await getDatabase().transaction(async (tx) => {
    const [claimed] = await tx.update(schema.extensionAuthCodes).set({ usedAt: now }).where(and(
      eq(schema.extensionAuthCodes.id, grant.id), eq(schema.extensionAuthCodes.tenantId, grant.tenantId),
      eq(schema.extensionAuthCodes.codeHash, grant.codeHash), isNull(schema.extensionAuthCodes.usedAt), gt(schema.extensionAuthCodes.expiresAt, now),
    )).returning({ id: schema.extensionAuthCodes.id });
    if (!claimed) throw new AuthenticationError("Código inválido ou expirado.");
    await tx.insert(schema.extensionSessions).values({ ...session, tokenHash: hash(rawToken) });
    await recordExtensionAudit("extension.session.created", session, {}, tx);
  });
  return { token: rawToken, session: { userId: session.userId, tenantId: session.tenantId, deviceId: session.deviceId,
    sessionId, expiresAt: expiresAt.toISOString(), permissions: session.permissions } satisfies ExtensionSession };
}

export async function renewExtensionSession(session: ExtensionPrincipal) {
  const token = randomBytes(48).toString("base64url");
  const now = new Date();
  await getDatabase().transaction(async (tx) => {
    const [updated] = await tx.update(schema.extensionSessions).set({ tokenHash: hash(token) }).where(and(
      eq(schema.extensionSessions.id, session.id), eq(schema.extensionSessions.tenantId, session.tenantId),
      eq(schema.extensionSessions.tokenHash, session.tokenHash), isNull(schema.extensionSessions.revokedAt),
      condicaoSessaoAtiva(now),
    )).returning({ id: schema.extensionSessions.id });
    if (!updated) throw new AuthenticationError("Sessão expirada ou já renovada.");
    await recordExtensionAudit("extension.session.renewed", session, {}, tx);
  });
  // expiresAt is immutable: rotation never extends the 30-day cap.
  return { token, session: { userId: session.userId, tenantId: session.tenantId, deviceId: session.deviceId,
    sessionId: session.id, expiresAt: session.expiresAt.toISOString(), permissions: session.permissions } satisfies ExtensionSession };
}

export async function revokeExtensionSession(session: ExtensionPrincipal) {
  await getDatabase().transaction(async (tx) => {
    await tx.update(schema.extensionSessions).set({ revokedAt: new Date() }).where(and(
      eq(schema.extensionSessions.id, session.id), eq(schema.extensionSessions.tenantId, session.tenantId), isNull(schema.extensionSessions.revokedAt),
    ));
    await recordExtensionAudit("extension.session.revoked", session, {}, tx);
  });
}
