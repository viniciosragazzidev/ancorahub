import { LightPageSkeleton } from "@/components/light/light-page-skeleton"
import { getRequiredTenantContext } from "@/shared/auth/tenant-context"
import { shouldUseDirectorLiteStyle } from "@/features/director-lite/style-flag"

/** Carregamento do painel: skeleton Lite quando a chave do diretor está ligada. */
export async function isDirectorLiteDashboardLoading() {
  try {
    const context = await getRequiredTenantContext()
    return await shouldUseDirectorLiteStyle(context.role, context.tenantId)
  } catch {
    return false
  }
}

export function DirectorLiteDashboardSkeleton() {
  return <LightPageSkeleton variant="dashboard" />
}
