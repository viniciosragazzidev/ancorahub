import { describe, expect, it } from "vitest";

import { shouldDisplayAd, shouldDisplayCampaign } from "./meta-analytics-service";

describe("campaign performance visibility", () => {
  it("keeps an active campaign visible even before its first lead", () => {
    expect(shouldDisplayCampaign("ACTIVE", 0)).toBe(true);
  });

  it("keeps a paused campaign visible when it has active leads", () => {
    expect(shouldDisplayCampaign("PAUSED", 3)).toBe(true);
  });

  it("hides a paused campaign with no active leads", () => {
    expect(shouldDisplayCampaign("PAUSED", 0)).toBe(false);
  });
});

describe("ad performance visibility", () => {
  it("keeps an active ad visible even before its first lead", () => {
    expect(shouldDisplayAd("ACTIVE", 0)).toBe(true);
  });

  it("keeps a paused ad visible when it has active leads", () => {
    expect(shouldDisplayAd("PAUSED", 2)).toBe(true);
  });

  it("hides a paused ad with no active leads", () => {
    expect(shouldDisplayAd("PAUSED", 0)).toBe(false);
  });
});
