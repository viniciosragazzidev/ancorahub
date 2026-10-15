import { describe, expect, it } from "vitest";

import { isLightRouteAllowed } from "./light-routes";

describe("/gestao/equipes/[supervisorId] no Lite", () => {
  it("is open to the Lite manager and to the Lite supervisor (who only sees their own team in the page)", () => {
    expect(isLightRouteAllowed("/gestao/equipes/sup-ana", "manager")).toBe(true);
    expect(isLightRouteAllowed("/gestao/equipes/sup-ana", "supervisor")).toBe(true);
  });

  it("stays closed for the broker and does not open deeper paths", () => {
    expect(isLightRouteAllowed("/gestao/equipes/sup-ana", "broker")).toBe(false);
    expect(isLightRouteAllowed("/gestao/equipes/sup-ana/corretores", "manager")).toBe(false);
  });

  it("lets the manager's 'Cobrar' link reach the relationship center", () => {
    expect(isLightRouteAllowed("/relacionamento", "manager")).toBe(true);
    expect(isLightRouteAllowed("/relacionamento?brokerId=b-1", "manager")).toBe(true);
  });
});
