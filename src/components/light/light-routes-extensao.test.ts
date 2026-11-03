import { describe, expect, it } from "vitest";
import { isLightRouteAllowed, resolveLightRoute } from "./light-routes";

describe("rota de conexão da extensão no Lite", () => {
  it("corretor pode abrir a página de conexão", () => {
    expect(isLightRouteAllowed("/extensao/conectar", "broker")).toBe(true);
  });

  it("volta para Configurações, no Lite", () => {
    const rota = resolveLightRoute("/extensao/conectar");
    expect(rota.title).toBe("Conectar extensão");
    expect(rota.parentHref).toBe("/settings");
  });
});
