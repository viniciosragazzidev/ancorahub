import { describe, expect, it, vi } from "vitest";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { resolveNegotiationsRouteAccess } from "./route-access";

describe("resolveNegotiationsRouteAccess", () => {
  it("mantém a flag da área ligada por padrão", () => {
    expect(FEATURE_FLAGS.NEGOTIATIONS_AREA.defaultValue).toBe("true");
  });

  it("não consulta rota nem permissões customizadas quando a área está desligada", async () => {
    const getPathname = vi.fn(() => "/negociacoes");
    const getCurrentRouteAccess = vi.fn(() => true);
    const checkRouteAccess = vi.fn(() => true);

    await expect(resolveNegotiationsRouteAccess({
      featureSetting: "false",
      role: "director",
      getPathname,
      getCurrentRouteAccess,
      checkRouteAccess,
    })).resolves.toBe(false);
    expect(getPathname).not.toHaveBeenCalled();
    expect(getCurrentRouteAccess).not.toHaveBeenCalled();
    expect(checkRouteAccess).not.toHaveBeenCalled();
  });

  it("reutiliza a autorização já calculada quando está na página de negociações", async () => {
    const getCurrentRouteAccess = vi.fn(async () => true);
    const checkRouteAccess = vi.fn(async () => false);

    await expect(resolveNegotiationsRouteAccess({
      featureSetting: Promise.resolve("true"),
      role: "director",
      getPathname: () => "/negociacoes?unidade=centro",
      getCurrentRouteAccess,
      checkRouteAccess,
    })).resolves.toBe(true);
    expect(getCurrentRouteAccess).toHaveBeenCalledOnce();
    expect(checkRouteAccess).not.toHaveBeenCalled();
  });

  it("não testa rotas para papéis sem acesso mesmo com a flag ligada", async () => {
    const getPathname = vi.fn(() => "/dashboard");
    const checkRouteAccess = vi.fn(() => true);

    await expect(resolveNegotiationsRouteAccess({
      featureSetting: "true",
      role: "broker",
      getPathname,
      getCurrentRouteAccess: () => false,
      checkRouteAccess,
    })).resolves.toBe(false);
    expect(getPathname).not.toHaveBeenCalled();
    expect(checkRouteAccess).not.toHaveBeenCalled();
  });
});
