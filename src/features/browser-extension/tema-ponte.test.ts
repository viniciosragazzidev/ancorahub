import { describe, expect, it } from "vitest";
import { corParaRgb, luminancia, temaPelaCor, variaveisDoTema } from "../../../apps/browser-extension/src/content/tema";

describe("ponte de tema", () => {
  it("lê rgb e rgba", () => {
    expect(corParaRgb("rgb(17, 27, 33)")).toEqual([17, 27, 33]);
    expect(corParaRgb("rgba(255, 255, 255, 0.5)")).toEqual([255, 255, 255]);
    expect(corParaRgb("transparent")).toBeNull();
  });

  it("classifica fundo escuro e claro", () => {
    expect(temaPelaCor("rgb(17, 27, 33)")).toBe("escuro");
    expect(temaPelaCor("rgb(255, 255, 255)")).toBe("claro");
    expect(luminancia([0, 0, 0])).toBe(0);
  });

  it("cai no claro quando a cor não é reconhecida", () => {
    expect(temaPelaCor("transparent")).toBe("claro");
  });

  it("entrega as mesmas variáveis nos dois temas", () => {
    expect(Object.keys(variaveisDoTema("escuro"))).toEqual(Object.keys(variaveisDoTema("claro")));
  });
});

