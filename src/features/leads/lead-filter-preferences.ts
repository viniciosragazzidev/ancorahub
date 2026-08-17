export type LeadFilterPreferences = {
  search: string;
  status: string;
  branch: string;
  tipo: string;
  origem: string;
  qualification: string;
  corretor: string;
  pageSize: string;
  eligibleCampaigns: boolean;
};

const preferenceKeys = ["search", "status", "branch", "tipo", "origem", "qualification", "corretor", "pageSize"] as const;

export const defaultLeadFilterPreferences: LeadFilterPreferences = {
  search: "",
  status: "",
  branch: "",
  tipo: "",
  origem: "",
  qualification: "",
  corretor: "",
  pageSize: "20",
  eligibleCampaigns: false,
};

/** Browser storage is untrusted: accept only the scalar shape owned by this UI. */
export function parseLeadFilterPreferences(raw: string | null): LeadFilterPreferences | null {
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Record<string, unknown>;
    if (!candidate || typeof candidate !== "object") return null;
    const values = Object.fromEntries(preferenceKeys.map((key) => [
      key,
      typeof candidate[key] === "string" && candidate[key].length <= 160 ? candidate[key] : defaultLeadFilterPreferences[key],
    ]));
    return {
      ...defaultLeadFilterPreferences,
      ...values,
      eligibleCampaigns: candidate.eligibleCampaigns === true,
    };
  } catch {
    return null;
  }
}

export function hasLeadFilterQuery(params: URLSearchParams) {
  return ["search", "status", "branch", "tipo", "origem", "qualification", "corretor", "pageSize", "eligibleCampaigns"]
    .some((key) => params.has(key));
}
