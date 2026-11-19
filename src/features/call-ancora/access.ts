import "server-only";

import { isActivePlatformAdmin } from "@/features/super-admin/view-as";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredSession } from "@/shared/auth/session";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { canUseCallAncora } from "./visibility";
import { callAncoraSessionOwnerId } from "./session-scope";

export async function requireCallAncoraAccess() {
  const [context, session] = await Promise.all([getRequiredTenantContext(), getRequiredSession()]);
  const platformAdmin = await isActivePlatformAdmin(session.user.id);
  const development = process.env.NODE_ENV === "development";
  const featureEnabled = (await getFeatureFlag(FEATURE_FLAGS.CALL_ANCORA_VISUAL).catch(() => "false")) === "true";
  if (!canUseCallAncora({ role: context.role, featureEnabled, platformAdmin, development })) {
    if (context.role === "broker") {
      throw new AuthorizationError("O Call Âncora está desativado pela plataforma.");
    }
    throw new AuthorizationError("O Call Âncora está disponível apenas para corretores e administradores da plataforma.");
  }
  return {
    context,
    sessionOwnerId: callAncoraSessionOwnerId(context, session.user.id),
    brokerName: session.user.name,
    flagBypass: platformAdmin || development,
  };
}
