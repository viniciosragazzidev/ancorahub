import "server-only";
import { cache } from "react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";

export type ErpSkin = "lite" | "standard";

/**
 * One rule for every ERP screen (docs/design-system.md): Lite audiences (broker, supervisor, manager Lite) and the
 * Director with `feature_director_lite_style` see the Lite system; everyone else sees the standard system.
 */
export const getErpSkin = cache(async (pathname: string): Promise<ErpSkin> => {
  const context = await getRequiredTenantContext();
  if (await getLiteAudience(context).catch(() => null)) return "lite";
  return (await isDirectorLitePageOnServer(context, pathname)) ? "lite" : "standard";
});
