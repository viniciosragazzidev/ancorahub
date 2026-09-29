import { describe, expect, it } from "vitest";

import { ctwaLeadName, readCtwaAdReferral } from "./meta-ctwa-referral";

describe("click-to-WhatsApp referral", () => {
  it("reads the ad of a first message from an ad", () => {
    expect(readCtwaAdReferral({ source_type: "ad", source_id: "120212345678901234", headline: " Plano de saúde ", ctwa_clid: "ARAkLk" })).toEqual({
      adId: "120212345678901234", headline: "Plano de saúde", sourceUrl: null, ctwaClid: "ARAkLk",
    });
  });

  it("keeps a post, a missing referral or a malformed id as conversation only", () => {
    expect(readCtwaAdReferral({ source_type: "post", source_id: "120212345678901234" })).toBeNull();
    expect(readCtwaAdReferral(undefined)).toBeNull();
    expect(readCtwaAdReferral({ source_type: "ad", source_id: "abc" })).toBeNull();
  });

  it("names the lead by the WhatsApp profile, or by the phone when the profile is not a name", () => {
    expect(ctwaLeadName("  Maria   Souza ", "5521999998888")).toBe("Maria Souza");
    expect(ctwaLeadName("🙂", "5521999998888")).toBe("Lead WhatsApp anúncio (8888)");
    expect(ctwaLeadName(undefined, "5521999998888")).toBe("Lead WhatsApp anúncio (8888)");
  });
});
