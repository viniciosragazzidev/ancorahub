// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { readSeen, writeSeen } from "./seen-storage";

afterEach(() => {
  delete document.documentElement.dataset.viewAs;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("seen marks", () => {
  it("are remembered on the device for the real user", () => {
    writeSeen("ancora:tour", "done");
    expect(window.localStorage.getItem("ancora:tour")).toBe("done");
    expect(readSeen("ancora:tour")).toBe("done");
  });

  it("never reach the device while a super admin views as someone", () => {
    document.documentElement.dataset.viewAs = "1";
    writeSeen("ancora:tour", "done");
    expect(window.localStorage.getItem("ancora:tour")).toBeNull();
    expect(readSeen("ancora:tour")).toBe("done");
    // Back to the real user: the tour was never marked as seen.
    delete document.documentElement.dataset.viewAs;
    expect(readSeen("ancora:tour")).toBeNull();
  });
});
