import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a theme font size next to a theme text color (status badge)", () => {
    const merged = cn("text-ds-caption leading-none", "bg-ds-amber-wash text-ds-amber-ink");
    expect(merged).toContain("text-ds-caption");
    expect(merged).toContain("text-ds-amber-ink");
  });

  it("still lets a later font size replace an earlier one", () => {
    expect(cn("text-ds-caption", "text-ds-body")).toBe("text-ds-body");
    expect(cn("text-sm", "text-ds-caption")).toBe("text-ds-caption");
    expect(cn("text-caption-1-regular", "text-xs")).toBe("text-xs");
  });

  it("still lets a later color replace an earlier one", () => {
    expect(cn("text-ds-steel", "text-ds-charcoal")).toBe("text-ds-charcoal");
  });
});
