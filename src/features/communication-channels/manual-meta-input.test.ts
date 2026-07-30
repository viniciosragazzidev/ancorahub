import { describe, expect, it } from "vitest";

import { manualMetaConnectionInputSchema, manualMetaLeadAdsSourceInputSchema } from "./manual-meta-input";

const validInput = {
  businessId: "1234567890",
  wabaId: "1234567891",
  phoneNumberId: "1234567892",
  accessToken: "token-de-teste-com-comprimento-seguro",
  facebookPageId: "",
  adAccountId: "",
  pixelId: "",
  datasetId: "",
};

describe("manual Meta connection input", () => {
  it("accepts only the client-owned integration values", () => {
    expect(manualMetaConnectionInputSchema.safeParse(validInput).success).toBe(true);
    expect(manualMetaConnectionInputSchema.safeParse({ ...validInput, adAccountId: "act_1234567890" }).success).toBe(true);
  });

  it("rejects malformed identifiers and a short access token", () => {
    expect(manualMetaConnectionInputSchema.safeParse({ ...validInput, wabaId: "abc" }).success).toBe(false);
    expect(manualMetaConnectionInputSchema.safeParse({ ...validInput, accessToken: "short" }).success).toBe(false);
  });

  it("accepts a lead ads page mapping without accepting a client token", () => {
    expect(manualMetaLeadAdsSourceInputSchema.safeParse({ pageId: "1234567890", adAccountId: "act_1234567891", branchId: null }).success).toBe(true);
    expect(manualMetaLeadAdsSourceInputSchema.safeParse({ pageId: "page-name", adAccountId: "", branchId: null }).success).toBe(false);
  });
});
