import { describe, expect, it } from "vitest";

import { teamNoticesFor } from "./catalog";

describe("teamNoticesFor", () => {
  it("lists the 24 h duty reminder only when the company flag is on", () => {
    expect(teamNoticesFor(false).map((notice) => notice.key)).not.toContain("DUTY_SHIFT_REMINDER");
    expect(teamNoticesFor(true).map((notice) => notice.key)).toContain("DUTY_SHIFT_REMINDER");
  });

  it("keeps every other notice in the same order whatever the flag says", () => {
    const off = teamNoticesFor(false).map((notice) => notice.key);
    const on = teamNoticesFor(true).map((notice) => notice.key).filter((key) => key !== "DUTY_SHIFT_REMINDER");
    expect(off).toEqual(on);
  });
});
