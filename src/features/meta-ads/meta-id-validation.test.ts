import { describe, expect, it } from "vitest";

import { isMetaAdAccountId, isMetaObjectId, isMetaPageId } from "./meta-id-validation";

describe("Meta asset identifier validation", () => {
  it("accepts real numeric Graph object identifiers", () => {
    expect(isMetaObjectId("1262967620230301")).toBe(true);
    expect(isMetaPageId("1262967620230301")).toBe(true);
    expect(isMetaAdAccountId("act_1234567890")).toBe(true);
    expect(isMetaAdAccountId("1234567890")).toBe(true);
  });

  it("rejects mock and malformed identifiers before a Graph request", () => {
    expect(isMetaObjectId("page_mock_456")).toBe(false);
    expect(isMetaPageId("page_mock_456")).toBe(false);
    expect(isMetaAdAccountId("act_mock_789")).toBe(false);
    expect(isMetaAdAccountId("account_123")).toBe(false);
    expect(isMetaObjectId("")).toBe(false);
  });
});
