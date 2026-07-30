import "server-only";

import { getSystemSettings } from "@/features/system-settings/queries";

export const META_LEAD_ADS_PLATFORM_SETTINGS = {
  partnerName: "meta_lead_ads_partner_name",
  businessId: "meta_lead_ads_partner_business_id",
  supportWhatsApp: "meta_lead_ads_support_whatsapp",
  pilotTenantIds: "meta_lead_ads_pilot_tenant_ids",
} as const;

export type MetaLeadAdsPlatformIdentity = {
  partnerName: string;
  businessId: string;
  supportWhatsApp: string;
};

const defaults: MetaLeadAdsPlatformIdentity = {
  partnerName: "Ancora Hub",
  businessId: "37173915645589885",
  supportWhatsApp: "+55 21 95930-7782",
};

function parseTenantIds(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item)) : [];
  } catch {
    return [];
  }
}

export async function getMetaLeadAdsPlatformIdentity(): Promise<MetaLeadAdsPlatformIdentity> {
  const settings = await getSystemSettings(Object.values(META_LEAD_ADS_PLATFORM_SETTINGS).slice(0, 3));
  const values = new Map(settings.map(({ key, value }) => [key, value]));
  return {
    partnerName: values.get(META_LEAD_ADS_PLATFORM_SETTINGS.partnerName)?.trim() || defaults.partnerName,
    businessId: values.get(META_LEAD_ADS_PLATFORM_SETTINGS.businessId)?.trim() || defaults.businessId,
    supportWhatsApp: values.get(META_LEAD_ADS_PLATFORM_SETTINGS.supportWhatsApp)?.trim() || defaults.supportWhatsApp,
  };
}

export async function getMetaLeadAdsPilotTenantIds() {
  const settings = await getSystemSettings([META_LEAD_ADS_PLATFORM_SETTINGS.pilotTenantIds]);
  return parseTenantIds(settings[0]?.value);
}

export async function isMetaLeadAdsTenantPilotEnabled(tenantId: string) {
  return (await getMetaLeadAdsPilotTenantIds()).includes(tenantId);
}
