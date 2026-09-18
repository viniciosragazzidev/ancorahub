import { describe, expect, it } from "vitest";
import { buildFollowUpWhen, FOLLOW_UP_OPTIONS } from "./follow-up-options";

describe("broker follow-up options", () => {
  it("offers a custom date for both follow-up stages", () => {
    expect(FOLLOW_UP_OPTIONS.no_contact.some((option) => option.value === "custom")).toBe(true);
    expect(FOLLOW_UP_OPTIONS.quote_sent.some((option) => option.value === "custom")).toBe(true);
  });

  it("serializes a selected date at the business start time", () => {
    expect(buildFollowUpWhen("custom", "2026-09-21")).toBe("2026-09-21T09:00:00-03:00");
    expect(buildFollowUpWhen("custom", "")).toBeNull();
  });
});
