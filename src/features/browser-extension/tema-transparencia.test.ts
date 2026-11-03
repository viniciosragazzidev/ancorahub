// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { corEfetiva, corParaRgba, temaPelaCor } from "../../../apps/browser-extension/src/content/tema";

describe("transparência na ponte de tema", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("rgba com alfa 0 é transparente e não vira escuro", () => {
    expect(corParaRgba("rgba(0, 0, 0, 0)")?.alfa).toBe(0);
    expect(temaPelaCor("rgba(0, 0, 0, 0)")).toBe("claro");
  });

  it("alfa abaixo de 0,5 conta como transparente", () => {
    expect(temaPelaCor("rgba(0, 0, 0, 0.3)")).toBe("claro");
    expect(temaPelaCor("rgba(17, 27, 33, 0.9)")).toBe("escuro");
  });

  it("body transparente: a superfície efetiva é o fundo do app, que decide o tema", () => {
    document.body.innerHTML = '<div id="app" style="background-color: rgb(17, 27, 33)"><main id="conversa"></main></div>';
    const conversa = document.getElementById("conversa");
    expect(corEfetiva(conversa)).toBe("rgb(17, 27, 33)");
    expect(temaPelaCor(corEfetiva(conversa) ?? "transparent")).toBe("escuro");
  });

  it("sem nenhuma superfície pintada, cai no claro", () => {
    document.body.innerHTML = '<div id="app"><main id="conversa"></main></div>';
    expect(corEfetiva(document.getElementById("conversa"))).toBeNull();
  });
});
