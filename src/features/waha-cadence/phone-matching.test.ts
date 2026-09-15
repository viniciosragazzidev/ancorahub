import { describe, expect, it } from "vitest";

import { phoneSubscriberSuffix, samePhoneSubscriber } from "./phone-matching";

describe("WAHA phone reconciliation", () => {
  it("matches the same subscriber when only the DDD differs", () => {
    expect(samePhoneSubscriber("+55 (22) 99876-5432", "+55 (21) 99876-5432")).toBe(true);
    expect(phoneSubscriberSuffix("+55 (22) 99876-5432")).toBe("998765432");
  });

  it("does not match numbers with different subscriber suffixes", () => {
    expect(samePhoneSubscriber("+55 (22) 99876-5432", "+55 (21) 99876-5433")).toBe(false);
    expect(samePhoneSubscriber("998765432", "8765432")).toBe(false);
  });
});
