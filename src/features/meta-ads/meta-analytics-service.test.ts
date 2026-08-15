import { describe, expect, it } from "vitest";

import { shouldDisplayCampaign } from "./meta-analytics-service";

describe("campaign performance visibility", () => {
  it("keeps an active campaign visible even before its first lead", () => {
    expect(shouldDisplayCampaign("ACTIVE", 0)).toBe(true);
  });

  it("keeps a paused campaign visible when it has attributed leads", () => {
    expect(shouldDisplayCampaign("PAUSED", 3)).toBe(true);
  });

  it("hides a paused campaign with no lead history", () => {
    expect(shouldDisplayCampaign("PAUSED", 0)).toBe(false);
  });
});
