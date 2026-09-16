export type MetaLeadAssetAttribution = {
  formId: string | null;
  campaignId: string | null;
};

/**
 * Indexes only campaign/form relationships already confirmed by a lead
 * attribution. Meta exposes forms at Page level, so this deliberately does
 * not infer a relationship for every form on the Page.
 */
export function indexInheritedCampaignIdsByForm(
  attributions: readonly MetaLeadAssetAttribution[],
  enabledCampaignIds: ReadonlySet<string>,
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const attribution of attributions) {
    if (!attribution.formId || !attribution.campaignId || !enabledCampaignIds.has(attribution.campaignId)) continue;

    const current = result.get(attribution.formId) ?? [];
    if (!current.includes(attribution.campaignId)) current.push(attribution.campaignId);
    result.set(attribution.formId, current);
  }

  return result;
}
