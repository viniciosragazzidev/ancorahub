import "server-only";

import { isActivePlatformAdmin } from "@/features/super-admin/view-as";
import { getRequiredSession } from "@/shared/auth/session";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/**
 * Área do diretor do Call Âncora (configurações e painel): diretor da empresa, admin ativo
 * da plataforma ou desenvolvimento local. Null quando não pode.
 *
 * O atalho de desenvolvimento nunca vale em produção: `next build` grava
 * `process.env.NODE_ENV` como "production" no bundle do servidor (define-env do Next; só
 * `experimental.allowDevelopmentBuild` mudaria isso, e o projeto não usa), então nem uma
 * variável NODE_ENV=development configurada no Coolify reabre o acesso. O Dockerfile também
 * fixa NODE_ENV=production no runner. Coberto por director-access.test.ts.
 */
export async function requireCallAncoraDirectorAccess() {
  const [context, session] = await Promise.all([getRequiredTenantContext(), getRequiredSession()]);
  const allowed = context.role === "director"
    || process.env.NODE_ENV === "development"
    || (await isActivePlatformAdmin(session.user.id));
  return allowed ? context : null;
}
