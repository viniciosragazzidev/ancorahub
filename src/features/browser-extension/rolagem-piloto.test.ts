// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cabeNaSecao, centralizarNaLista, focarSemRolar } from "../../../apps/browser-extension/src/content/rolagem";

const fonte = (relativo: string) => readFileSync(join(process.cwd(), "apps/browser-extension/src", relativo), "utf8");

function medir(el: HTMLElement, medidas: { scrollHeight?: number; clientHeight?: number; top?: number; offsetHeight?: number }) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: medidas.scrollHeight ?? 0 });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: medidas.clientHeight ?? 0 });
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: medidas.offsetHeight ?? 0 });
  el.getBoundingClientRect = () => ({ top: medidas.top ?? 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return {}; } });
}

describe("rolagem da extensão no WhatsApp Web (piloto 03/11)", () => {
  it("foca sem rolar a página", () => {
    const campo = document.createElement("div");
    const focus = vi.spyOn(campo, "focus");
    focarSemRolar(campo);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("botão que estoura a seção não cabe (não é inserido)", () => {
    const secao = document.createElement("div");
    medir(secao, { scrollHeight: 700, clientHeight: 648 });
    expect(cabeNaSecao(secao)).toBe(false);
    medir(secao, { scrollHeight: 648, clientHeight: 648 });
    expect(cabeNaSecao(secao)).toBe(true);
  });

  it("centraliza o item só dentro da lista, sem tocar em outro rolável", () => {
    const lista = document.createElement("div");
    const item = document.createElement("div");
    medir(lista, { clientHeight: 400, top: 100 });
    medir(item, { offsetHeight: 40, top: 700 });
    lista.scrollTop = 0;
    centralizarNaLista(lista, item);
    // (700 - 100) - (400 - 40) / 2 = 420
    expect(lista.scrollTop).toBe(420);
  });

  it("nenhum trecho da extensão rola a página: sem scrollIntoView e sem focus() cru", () => {
    for (const arquivo of ["content/painel.ts", "content/whatsapp-adapter.ts", "content/index.ts", "panel/ofertas.tsx"]) {
      const codigo = fonte(arquivo);
      expect(codigo, arquivo).not.toMatch(/scrollIntoView/);
      expect(codigo, arquivo).not.toMatch(/\.focus\(\)/);
    }
  });
});
