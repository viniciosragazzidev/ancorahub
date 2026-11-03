import "server-only";
import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { AuthorizationError } from "@/shared/auth/errors";
import { authenticateExtensionRequest, getExtensionExchangePrincipal, touchExtensionSession, type ExtensionGrant } from "./auth";
import { getExtensionTenantContext } from "./context";
import { extensionDeviceSchema } from "./schemas";
import { enforceExtensionRateLimit, extensionRouteKey } from "./rate-limit";
import { isExtensionPilotUser } from "./pilot";

export type ExtensionPermission = "VIEW_LEAD" | "ACCEPT_LEAD" | "CHANGE_STATUS" | "REGISTER_FEEDBACK" | "CREATE_TASK" | "GENERATE_REPLY" | "EXCHANGE_CODE";

export async function requireExtensionAccess(request: Request, permission: ExtensionPermission) {
  // Exchange authenticates the short-lived CRM grant, because a session does not exist yet.
  const exchange = permission === "EXCHANGE_CODE";
  if (exchange && new URL(request.url).pathname !== "/api/extension/auth/exchange") throw new AuthorizationError("Operação inválida.");
  const identity = exchange ? await getExtensionExchangePrincipal(extensionDeviceSchema.parse(await request.clone().json()))
    : { session: await authenticateExtensionRequest(request), grant: null as ExtensionGrant | null };
  const { session } = identity;
  const context = await getExtensionTenantContext(session.userId, session.tenantId);
  if (!context?.branchId || !["broker", "manager", "director"].includes(context.role)) throw new AuthorizationError("Vínculo ou unidade inválidos.");
  if ((await getSystemSetting("feature_browser_extension_enabled")) === "false") throw new AuthorizationError("Extensão desativada.");
  if (!await isExtensionPilotUser(session.userId)) throw new AuthorizationError("Extensão desativada.");
  const [settings] = await getDatabase().select().from(schema.extensionSettings)
    .where(eq(schema.extensionSettings.tenantId, session.tenantId)).limit(1);
  if (!settings?.enabled) throw new AuthorizationError("Extensão desativada.");
  if (!exchange && !session.permissions.includes(permission)) throw new AuthorizationError("Permissão insuficiente.");
  enforceExtensionRateLimit(extensionRouteKey(request), session.id);
  if (!exchange) await touchExtensionSession(session);
  return { ...identity, context, settings };
}
