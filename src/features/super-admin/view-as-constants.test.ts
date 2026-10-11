import { describe, expect, it } from "vitest";

import { isViewAsBlockedWrite } from "./view-as-constants";

describe("Ver como is read only", () => {
  it("lets reads through", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) expect(isViewAsBlockedWrite(method, "/leads")).toBe(false);
  });

  it("blocks every write, including server actions on any page and API routes", () => {
    expect(isViewAsBlockedWrite("POST", "/leads/abc")).toBe(true);
    expect(isViewAsBlockedWrite("POST", "/api/journey/celebrations")).toBe(true);
    expect(isViewAsBlockedWrite("PUT", "/api/internal/mark-read")).toBe(true);
    expect(isViewAsBlockedWrite("DELETE", "/api/anything")).toBe(true);
  });

  it("still allows starting, stopping and signing out", () => {
    expect(isViewAsBlockedWrite("POST", "/api/super-admin/view-as")).toBe(false);
    expect(isViewAsBlockedWrite("POST", "/api/auth/sign-out")).toBe(false);
  });
});
