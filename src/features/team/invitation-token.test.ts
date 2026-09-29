import { describe, expect, it } from "vitest";

import { normalizeInvitationToken } from "./invitation-token";

describe("normalizeInvitationToken", () => {
  it("removes the encoded Meta named URL placeholder before the real token", () => {
    expect(normalizeInvitationToken("%7B%7Bactivation_token%7D%7Dvalid-token_123")).toBe("valid-token_123");
    expect(normalizeInvitationToken("%257B%257Bactivation_token%257D%257Dvalid-token_123")).toBe("valid-token_123");
  });

  it("removes the stale Meta id placeholder appended after the real token", () => {
    expect(normalizeInvitationToken("valid-token_123%7B%7Bid%7D%7D")).toBe("valid-token_123");
    expect(normalizeInvitationToken("valid-token_123{{id}}")).toBe("valid-token_123");
    expect(normalizeInvitationToken("valid-token_123%257B%257Bid%257D%257D")).toBe("valid-token_123");
  });

  it("preserves the standard access token", () => {
    expect(normalizeInvitationToken("valid-token_123")).toBe("valid-token_123");
  });

  it("removes {id} placeholder before the real token (bug do modelo meta)", () => {
    // Token vem com {id} codificado antes do token real, ex: %7B%7Bid%7D%7Dr0nDuj...
    expect(normalizeInvitationToken("%7B%7Bid%7D%7Dr0nDuj713hg2S86hz6O2nM8-PB_14He8WSXZpnrHx8")).toBe("r0nDuj713hg2S86hz6O2nM8-PB_14He8WSXZpnrHx8");
    // Versão já decodificada (após decodeURIComponent)
    expect(normalizeInvitationToken("{id}r0nDuj713hg2S86hz6O2nM8-PB_14He8WSXZpnrHx8")).toBe("r0nDuj713hg2S86hz6O2nM8-PB_14He8WSXZpnrHx8");
  });

  it("does not alter an unrelated malformed value", () => {
    expect(normalizeInvitationToken("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
