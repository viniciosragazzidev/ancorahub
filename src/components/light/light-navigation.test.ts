import { describe, expect, it } from "vitest";

import { backDecision, nextEntries } from "./light-navigation";

describe("light app history", () => {
  it("settings → profile → back → back returns to Início, never to profile again", () => {
    let entries = nextEntries([], "push", "/dashboard");
    entries = nextEntries(entries, "push", "/settings");
    entries = nextEntries(entries, "push", "/settings/profile");
    // Back on profile: previous screen is in the app → history.
    expect(backDecision(entries, "/settings", false)).toBe("history");
    entries = nextEntries(entries, "pop", "/settings");
    expect(entries).toEqual(["/dashboard", "/settings"]);
    // Back on settings goes to Início (history), not forward to profile.
    expect(backDecision(entries, "/dashboard", false)).toBe("history");
    entries = nextEntries(entries, "pop", "/dashboard");
    expect(entries).toEqual(["/dashboard"]);
  });

  it("opened from outside: back goes to the parent by replacing, so there is no loop", () => {
    let entries = nextEntries([], "push", "/settings/profile");
    expect(backDecision(entries, "/settings", false)).toBe("parent");
    entries = nextEntries(entries, "replace", "/settings");
    expect(entries).toEqual(["/settings"]);
    expect(backDecision(entries, "/dashboard", false)).toBe("parent");
  });

  it("alwaysParent uses history only when the previous screen is that parent", () => {
    const fromList = ["/conversas/broker", "/conversas/broker?todas=1"];
    expect(backDecision(fromList, "/conversas/broker", true)).toBe("history");
    const fromLead = ["/leads/1", "/conversas/broker?todas=1"];
    expect(backDecision(fromLead, "/conversas/broker", true)).toBe("parent");
  });
});
