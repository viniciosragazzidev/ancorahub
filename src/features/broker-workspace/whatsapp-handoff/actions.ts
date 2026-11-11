"use server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { isAcceptHandoffEnabled } from "./flag";

/** O cliente pergunta uma vez por carga de página; erro ou papel fora do corretor = desligado. */
export async function getAcceptHandoffEnabledAction(): Promise<boolean> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker") return false;
    return await isAcceptHandoffEnabled(context.tenantId);
  } catch {
    return false;
  }
}
