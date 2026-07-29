import { describe, expect, it } from "vitest";

import { normalizeInvitationToken } from "./invitation-token";

describe("normalizeInvitationToken", () => {
  it("removes the encoded Meta named URL placeholder before the real token", () => {
    expect(normalizeInvitationToken("%7B%7Bactivation_token%7D%7Dvalid-token_123")).toBe("valid-token_123");
    expect(normalizeInvitationToken("%257B%257Bactivation_token%257D%257Dvalid-token_123")).toBe("valid-token_123");
  });

  it("preserves the standard access token", () => {
    expect(normalizeInvitationToken("valid-token_123")).toBe("valid-token_123");
  });

  it("does not alter an unrelated malformed value", () => {
    expect(normalizeInvitationToken("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
