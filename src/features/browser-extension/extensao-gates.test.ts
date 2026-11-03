import { describe, expect, it } from "vitest";
import { decidirSaidaPrebuild, LIMITES_EXTENSAO, verificarLimites } from "../../../scripts/extensao-gates.mjs";

const KB = 1024;

describe("limites de tamanho da extensão (gzip)", () => {
  it("passa quando service worker + conteúdo ficam até 30 KB e o painel até 200 KB", () => {
    expect(verificarLimites({
      "background-service-worker.js": 4 * KB, "content-index.js": 1.9 * KB, "panel/panel.js": 65 * KB,
    })).toEqual([]);
  });

  it("acusa o grupo que passou do limite, com tamanho e limite na mensagem", () => {
    const linhas = verificarLimites({ "background-service-worker.js": 25 * KB, "content-index.js": 6 * KB, "panel/panel.js": 65 * KB });
    expect(linhas).toEqual(["service worker + conteúdo: 31.0 KB gzip (limite 30 KB)"]);
  });

  it("acusa o painel acima de 200 KB sem olhar o grupo do conteúdo", () => {
    const linhas = verificarLimites({ "background-service-worker.js": 1 * KB, "content-index.js": 1 * KB, "panel/panel.js": 201 * KB });
    expect(linhas).toEqual(["painel React: 201.0 KB gzip (limite 200 KB)"]);
  });

  it("os limites da README são 30 KB e 200 KB", () => {
    expect(LIMITES_EXTENSAO.map((grupo) => grupo.limiteBytes)).toEqual([30 * KB, 200 * KB]);
  });
});

describe("código de saída do prebuild", () => {
  it("fora do modo estrito, a falha sai com 0 e o build do site segue", () => {
    expect(decidirSaidaPrebuild({ estrito: false, publicado: false, codigoFalha: 2 })).toBe(0);
  });

  it("no modo estrito (CI), a falha sai com o código da etapa que falhou", () => {
    expect(decidirSaidaPrebuild({ estrito: true, publicado: false, codigoFalha: 2 })).toBe(2);
  });

  it("no modo estrito, sem código (sinal ou erro de rename), sai com 1, nunca com 0", () => {
    expect(decidirSaidaPrebuild({ estrito: true, publicado: false, codigoFalha: 0 })).toBe(1);
  });

  it("zip publicado sai com 0 mesmo no modo estrito", () => {
    expect(decidirSaidaPrebuild({ estrito: true, publicado: true, codigoFalha: 0 })).toBe(0);
  });
});
