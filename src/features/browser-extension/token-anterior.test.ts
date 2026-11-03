import { describe, expect, it } from "vitest";
import { createPreviousTokenWindow, ROTATION_GRACE_MS } from "./token-anterior";

describe("janela de tolerância do token anterior depois da rotação", () => {
  it("aceita o token trocado até 60 s depois, com a sessão dona dele", () => {
    const janela = createPreviousTokenWindow();
    janela.registrar("hash-antigo", "sessao-a", 1_000);
    expect(janela.sessaoDoTokenAnterior("hash-antigo", 1_000)).toBe("sessao-a");
    expect(janela.sessaoDoTokenAnterior("hash-antigo", 1_000 + ROTATION_GRACE_MS - 1)).toBe("sessao-a");
  });

  it("recusa o token trocado depois da janela", () => {
    const janela = createPreviousTokenWindow();
    janela.registrar("hash-antigo", "sessao-a", 1_000);
    expect(janela.sessaoDoTokenAnterior("hash-antigo", 1_000 + ROTATION_GRACE_MS)).toBeNull();
    // Depois de vencido, nem volta a valer se o relógio andar para trás.
    expect(janela.sessaoDoTokenAnterior("hash-antigo", 1_000)).toBeNull();
  });

  it("não aceita hash que nunca foi trocado", () => {
    const janela = createPreviousTokenWindow();
    janela.registrar("hash-antigo", "sessao-a", 0);
    expect(janela.sessaoDoTokenAnterior("hash-qualquer", 0)).toBeNull();
  });

  it("cada troca tem a própria janela; a segunda não reabre a primeira", () => {
    const janela = createPreviousTokenWindow();
    janela.registrar("hash-1", "sessao-a", 0);
    janela.registrar("hash-2", "sessao-a", 50_000);
    expect(janela.sessaoDoTokenAnterior("hash-1", 59_999)).toBe("sessao-a");
    expect(janela.sessaoDoTokenAnterior("hash-1", 60_000)).toBeNull();
    expect(janela.sessaoDoTokenAnterior("hash-2", 60_000)).toBe("sessao-a");
    expect(janela.sessaoDoTokenAnterior("hash-2", 110_000)).toBeNull();
  });

  it("a janela é de 60 segundos por padrão", () => {
    expect(ROTATION_GRACE_MS).toBe(60_000);
  });
});
