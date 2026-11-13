import { describe, expect, it } from "vitest";

import { canAccessRoute, firstAllowedPath, resolveEffectiveAccess } from "@/features/custom-roles/effective-access";
import { getRouteDefinition, getRouteDefinitionByKey, routeCatalog, routePermissionKey } from "@/features/custom-roles/routes";
import { PERMISSIONS } from "@/shared/auth/permissions";

import { ERP_ROUTE_RESERVATIONS } from "./route-reservations";

describe("ERP reservations cannot grant access to unfinished modules", () => {
  it("denies every reservation and its object pages, with or without forged grants", () => {
    for (const role of ["broker", "supervisor", "manager", "director"]) {
      for (const cargo of [null, {
        status: "active",
        permissions: [
          ...Object.keys(PERMISSIONS),
          ...ERP_ROUTE_RESERVATIONS.map((route) => routePermissionKey(route.key)),
        ],
      }]) {
        const access = resolveEffectiveAccess({ role, jobTitle: "finance", cargo });
        for (const reservation of ERP_ROUTE_RESERVATIONS) {
          for (const path of [reservation.path, `${reservation.path}/synthetic-record`]) {
            const definition = getRouteDefinition(path);
            expect(definition?.readiness).toBe("planned");
            expect(canAccessRoute(access, definition)).toBe(false);
          }
          expect(canAccessRoute(access, getRouteDefinitionByKey(reservation.key))).toBe(false);
        }
        expect(firstAllowedPath(access)?.startsWith("/financeiro")).not.toBe(true);
      }
    }
  });

  it("overrides an allowed parent for a reserved report without closing existing reports", () => {
    const access = resolveEffectiveAccess({
      role: "director", cargo: { status: "active", permissions: ["route:relatorios"] },
    });
    expect(canAccessRoute(access, getRouteDefinition("/relatorios"))).toBe(true);
    expect(canAccessRoute(access, getRouteDefinition("/relatorios/drill/lead-quality"))).toBe(true);
    expect(getRouteDefinition("/relatorios/operadoras")?.key).toBe("erp-operadoras");
    expect(canAccessRoute(access, getRouteDefinition("/relatorios/operadoras"))).toBe(false);
    expect(canAccessRoute(access, getRouteDefinition("/relatorios/operadoras/one"))).toBe(false);
  });

  it("keeps reservations out of assignable routes and cargo landing pages", () => {
    for (const reservation of ERP_ROUTE_RESERVATIONS) {
      expect(routeCatalog.some((route) => route.key === reservation.key || route.path === reservation.path)).toBe(false);
    }
    const cargo = { status: "active", permissions: ["route:erp-financeiro", "route:vendas"] };
    expect(firstAllowedPath(resolveEffectiveAccess({ role: "director", cargo }))).toBe("/vendas");
  });

  it("keeps existing commission configuration and path boundaries unchanged", () => {
    const director = resolveEffectiveAccess({ role: "director", cargo: null });
    expect(getRouteDefinition("/configuracoes/comissoes")?.key).toBe("configuracoes");
    expect(canAccessRoute(director, getRouteDefinition("/configuracoes/comissoes"))).toBe(true);
    expect(getRouteDefinition("/financeiro-extra")).toBeUndefined();
    expect(getRouteDefinition("/relatorios/operadoras-extra")?.key).toBe("relatorios");
    expect(getRouteDefinition("/financeiro/recibos/item")?.key).toBe("erp-recibos");
  });
});
