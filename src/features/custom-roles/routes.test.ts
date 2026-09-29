import { describe, expect, it } from "vitest";
import { getRouteDefinition, isRoutePermission, routePermissionForPath, routePermissionKey } from "./routes";

describe("custom role route visibility", () => {
  it("maps nested URLs to the canonical route key", () => {
    expect(getRouteDefinition("/equipe/cargos")?.key).toBe("equipe");
    expect(routePermissionForPath("/marketing/campanhas/123")).toBe(routePermissionKey("campanhas"));
  });

  it("recognizes only the route permission namespace", () => {
    expect(isRoutePermission("route:leads")).toBe(true);
    expect(isRoutePermission("acessar_leads")).toBe(false);
    expect(isRoutePermission("route:")).toBe(false);
  });
});
