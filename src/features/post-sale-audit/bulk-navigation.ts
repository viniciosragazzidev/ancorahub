import { POST_SALE_CAMPAIGN_MAX_LEADS } from "./rules";

export function buildPostSaleAudienceHref(leadIds: readonly string[]) {
  const uniqueIds = [...new Set(leadIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length || uniqueIds.length > POST_SALE_CAMPAIGN_MAX_LEADS) return null;
  return `/equipe/pos-venda?leadIds=${encodeURIComponent(uniqueIds.join(","))}`;
}
