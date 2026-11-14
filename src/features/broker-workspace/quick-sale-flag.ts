import "server-only";

import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/** Registrar venda em dois toques (`feature_broker_quick_sale_enabled`, ligada por padrão). Falha de leitura conta como desligada. */
export async function isBrokerQuickSaleEnabled(): Promise<boolean> {
  return (await getFeatureFlag(FEATURE_FLAGS.BROKER_QUICK_SALE).catch(() => "false")) === "true";
}
