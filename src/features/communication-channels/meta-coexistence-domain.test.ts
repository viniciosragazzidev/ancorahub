import { describe, expect, it } from "vitest";

import { resolveMetaChannelDefault, selectPartnerRemovedChannels, selectUnconnectedCoexistencePhoneId } from "./meta-coexistence-domain";

describe("Coex channel integrity", () => {
  it("never promotes a coexistence channel to the corporate default", () => {
    expect(resolveMetaChannelDefault({ coexistence: true, existingIsDefault: true, currentDefaultExists: false })).toBe(false);
    expect(resolveMetaChannelDefault({ coexistence: false, existingIsDefault: false, currentDefaultExists: false })).toBe(true);
    expect(resolveMetaChannelDefault({ coexistence: false, existingIsDefault: false, currentDefaultExists: true })).toBe(false);
  });

  it("matches PARTNER_REMOVED by phone number ID first and exact last eight digits otherwise", () => {
    const channels = [
      { id: "a", phoneNumberId: "phone-a", displayPhoneNumber: "+55 21 97350-7276" },
      { id: "b", phoneNumberId: "phone-b", displayPhoneNumber: "+55 21 97350-1234" },
    ];
    expect(selectPartnerRemovedChannels({ channels, phoneNumberId: "phone-b", phone: "5521973507276" }).map((row) => row.id)).toEqual(["b"]);
    expect(selectPartnerRemovedChannels({ channels, phone: "5521973507276" }).map((row) => row.id)).toEqual(["a"]);
    expect(selectPartnerRemovedChannels({ channels, phoneNumberId: "missing", phone: "5521973507276" })).toEqual([]);
    expect(selectPartnerRemovedChannels({ channels })).toEqual([]);
  });

  it("does not guess when a phone suffix is ambiguous", () => {
    const channels = [
      { id: "a", phoneNumberId: "phone-a", displayPhoneNumber: "+55 21 97350-7276" },
      { id: "b", phoneNumberId: "phone-b", displayPhoneNumber: "+1 21 97350-7276" },
    ];
    expect(selectPartnerRemovedChannels({ channels, phone: "5521973507276" })).toEqual([]);
  });

  it("does not reuse an already-connected number when adding Coex", () => {
    const phones = [{ id: "phone-a" }, { id: "phone-b" }];
    expect(selectUnconnectedCoexistencePhoneId({ candidates: phones, connectedPhoneNumberIds: new Set(["phone-a"]) })).toBe("phone-b");
    expect(selectUnconnectedCoexistencePhoneId({ candidates: phones, connectedPhoneNumberIds: new Set(["phone-a", "phone-b"]) })).toBeNull();
  });
});
