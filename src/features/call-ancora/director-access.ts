import "server-only";

import { isActivePlatformAdmin } from "@/features/super-admin/view-as";
import { getRequiredSession } from "@/shared/auth/session";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/**
 * Área do diretor do Call Âncora (configurações e painel): diretor da empresa, admin ativo
 * da plataforma ou desenvolvimento local. Null quando não pode.
 */
export async function requireCallAncoraDirectorAccess() {
  const [context, session] = await Promise.all([getRequiredTenantContext(), getRequiredSession()]);
  const allowed = context.role === "director"
    || process.env.NODE_ENV === "development"
    || (await isActivePlatformAdmin(session.user.id));
  return allowed ? context : null;
}
