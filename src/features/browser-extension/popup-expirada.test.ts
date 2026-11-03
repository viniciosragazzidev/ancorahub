// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

// Dados falsos: a conta anterior guardada na credencial.
const NOME_ANTERIOR = "Conta Anterior Falsa";
const UNIDADE_ANTERIOR = "Unidade Anterior Falsa";

// Worker falso: devolve a credencial com a conta anterior e responde 401 ao consultar a sessão.
function montarChrome() {
  const sendMessage = vi.fn((mensagem: { type: string }, responder: (resposta: unknown) => void) => {
    if (mensagem.type === "LER_CREDENCIAL") {
      responder({ geracao: "g1", perfil: { nome: NOME_ANTERIOR, unidade: UNIDADE_ANTERIOR, userId: "u1", sessionId: "s1" } });
    } else if (mensagem.type === "API_REQUEST") {
      responder({ ok: false, status: 401, body: {}, geracao: "g1" });
    } else {
      responder(null);
    }
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage, lastError: undefined } });
}

describe("popup com sessão expirada", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("não mostra o nome nem a unidade da conta anterior", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    montarChrome();
    await import("../../../apps/browser-extension/src/popup/index");
    await vi.waitFor(() => expect(document.querySelector(".selo.aviso")?.textContent).toMatch(/Sessão expirada/));
    const texto = document.querySelector("#root")?.textContent ?? "";
    expect(texto).not.toContain(NOME_ANTERIOR);
    expect(texto).not.toContain(UNIDADE_ANTERIOR);
    expect(document.querySelector("#conectar-crm")).not.toBeNull();
  });
});
