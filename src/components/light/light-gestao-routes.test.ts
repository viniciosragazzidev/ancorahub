import { describe, expect, it } from "vitest";

import { getLightMoreDestinations, isLightRouteAllowed } from "./light-routes";

describe("/gestao no Lite", () => {
  it("is open to the Lite manager and to the Lite supervisor (who is redirected by the page)", () => {
    expect(isLightRouteAllowed("/gestao", "manager")).toBe(true);
    expect(isLightRouteAllowed("/gestao", "supervisor")).toBe(true);
  });

  it("stays closed for the broker and keeps the team detail to the managers and supervisors (G2)", () => {
    expect(isLightRouteAllowed("/gestao", "broker")).toBe(false);
    expect(isLightRouteAllowed("/gestao/equipes/sup-ana", "broker")).toBe(false);
  });

  it("shows the Gestão item in the manager's Mais only when the flag is on", () => {
    expect(getLightMoreDestinations({ teamManagement: true }, "manager").map((item) => item.href)).toContain("/gestao");
    expect(getLightMoreDestinations({ teamManagement: false }, "manager").map((item) => item.href)).not.toContain("/gestao");
    expect(getLightMoreDestinations({}, "manager").map((item) => item.href)).not.toContain("/gestao");
  });
});
