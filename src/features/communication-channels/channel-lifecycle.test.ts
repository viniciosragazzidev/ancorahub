import { describe, expect, it } from "vitest";

import { getMetaCloudChannelActivationError } from "./channel-lifecycle";

describe("getMetaCloudChannelActivationError", () => {
  it("blocks reactivation after disconnect removed the Meta credential", () => {
    expect(getMetaCloudChannelActivationError({
      phoneNumberId: "phone-1",
      registrationStatus: "registered",
      hasCredentials: false,
    })).toBe("Este canal foi desconectado. Reconecte o número pela Meta para restaurar a autorização.");
  });

  it("allows a registered channel with its encrypted credential", () => {
    expect(getMetaCloudChannelActivationError({
      phoneNumberId: "phone-1",
      registrationStatus: "registered",
      hasCredentials: true,
    })).toBeNull();
  });
});
