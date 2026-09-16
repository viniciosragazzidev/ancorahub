import { describe, expect, it } from "vitest";

import { indexInheritedCampaignIdsByForm } from "./meta-capture-inheritance";

describe("indexInheritedCampaignIdsByForm", () => {
  it("indexes only forms attributed to enabled campaigns", () => {
    const result = indexInheritedCampaignIdsByForm([
      { formId: "form-a", campaignId: "campaign-enabled" },
      { formId: "form-a", campaignId: "campaign-enabled" },
      { formId: "form-b", campaignId: "campaign-disabled" },
      { formId: null, campaignId: "campaign-enabled" },
    ], new Set(["campaign-enabled"]));

    expect(Array.from(result.entries())).toEqual([["form-a", ["campaign-enabled"]]]);
  });

  it("does not infer a campaign for a page-level form without attribution", () => {
    expect(indexInheritedCampaignIdsByForm([], new Set(["campaign-enabled"]))).toEqual(new Map());
  });
});
