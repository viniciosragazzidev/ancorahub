import "server-only";
import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import type { TenantContext } from "@/shared/auth/types";
import {
  brokerHomePilotApplies,
  inactiveBrokerHomePilot,
  parseBrokerHomePilot,
} from "./home-pilot";

export function brokerHomePilotSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.BROKER_HOME_V2.key}_${tenantId}`;
}

export async function getBrokerHomePresentation(context: TenantContext) {
  if (context.role !== "broker") return inactiveBrokerHomePilot;
  const pilot = parseBrokerHomePilot(
    await getSystemSetting(brokerHomePilotSettingKey(context.tenantId)).catch(() => undefined),
  );
  return { ...pilot, enabled: brokerHomePilotApplies(pilot, context) };
}
