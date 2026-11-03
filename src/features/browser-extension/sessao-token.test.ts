import { describe, expect, it, vi } from "vitest";
import { chamarApi, ROTACAO_APOS_MS, type Dependencias, type RespostaApi } from "../../../apps/browser-extension/src/background/sessao-token";
import { estadoPorStatus } from "../../../apps/browser-extension/src/shared/estado-sessao";

const HORA = 60 * 60_000;

// Token falso: nenhum valor real.
function ambiente(inicio: { token: string; tokenEm: number }, agora = { valor: inicio.tokenEm }) {
  let credencial: { token?: string; tokenEm?: number } = { ...inicio };
  const usados: Array<string | null> = [];
  const postsSessao: Array<string | null> = [];
  const rede = vi.fn(async (path: string, method: "GET" | "POST", token: string | null, corpo?: unknown): Promise<RespostaApi> => {
    if (path === "/api/extension/session" && method === "POST") {
      postsSessao.push(token);
      return { ok: true, status: 200, body: { token: "token-rotacionado-novo" } };
    }
    usados.push(token);
    return { ok: true, status: 200, body: { path, corpo } };
  });
  const deps: Dependencias = {
    armazem: {
      ler: async () => ({ ...credencial }),
      gravar: async (c) => { credencial = { ...c }; },
      limpar: async () => { credencial = {}; },
    },
    rede,
    agora: () => agora.valor,
  };
  return { deps, usados, postsSessao, credencial: () => credencial, rede, agora };
}

describe("rotação do token no service worker", () => {
  it("dentro de 24 h usa o token atual e não rotaciona", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = 2 * HORA;
    await chamarApi(a.deps, "/api/extension/leads/resolve", "POST", { phone: "x" });
    expect(a.postsSessao).toHaveLength(0);
    expect(a.usados).toEqual(["token-antigo"]);
  });

  it("depois de 24 h rotaciona antes da chamada e grava o token novo", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = ROTACAO_APOS_MS + 1;
    await chamarApi(a.deps, "/api/extension/inbox", "GET");
    expect(a.postsSessao).toEqual(["token-antigo"]);
    expect(a.usados).toEqual(["token-rotacionado-novo"]);
    expect(a.credencial()).toEqual({ token: "token-rotacionado-novo", tokenEm: ROTACAO_APOS_MS + 1 });
  });

  it("várias chamadas ao mesmo tempo compartilham uma única rotação", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = ROTACAO_APOS_MS + 1;
    await Promise.all([1, 2, 3, 4, 5].map((n) => chamarApi(a.deps, `/api/extension/leads/${n}`, "GET")));
    expect(a.postsSessao).toHaveLength(1);
    expect(a.usados).toHaveLength(5);
    expect(a.usados.every((token) => token === "token-rotacionado-novo")).toBe(true);
  });

  it("401 na troca limpa a credencial e não manda o token antigo adiante", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = ROTACAO_APOS_MS + 1;
    a.rede.mockImplementationOnce(async () => ({ ok: false, status: 401, body: {} }));
    const resposta = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(resposta.status).toBe(401);
    expect(a.credencial()).toEqual({});
    expect(a.usados).toHaveLength(0);
  });

  it("falha transitória na troca mantém o token atual e segue", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = ROTACAO_APOS_MS + 1;
    a.rede.mockImplementationOnce(async () => ({ ok: false, status: 0, body: {} }));
    await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(a.credencial().token).toBe("token-antigo");
    expect(a.usados).toEqual(["token-antigo"]);
  });

  it("401 em voo com token já rotacionado: tenta de novo com o token novo", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = 2 * HORA;
    a.rede.mockImplementationOnce(async (_path, _method, token) => {
      // Simula a rotação acontecendo enquanto esta chamada estava em voo.
      await a.deps.armazem.gravar({ token: "token-rotacionado-novo", tokenEm: a.agora.valor });
      return { ok: false, status: 401, body: {} };
    });
    const resposta = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(resposta.ok).toBe(true);
    expect(a.rede).toHaveBeenCalledTimes(2);
    expect(a.rede.mock.calls[1][2]).toBe("token-rotacionado-novo");
  });

  it("401 sem troca de token limpa a credencial (sem sessão, nada fica guardado)", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = 2 * HORA;
    a.rede.mockImplementationOnce(async () => ({ ok: false, status: 401, body: {} }));
    await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(a.credencial()).toEqual({});
  });

  it("429 devolve o Retry-After para a tela", async () => {
    const a = ambiente({ token: "token-antigo", tokenEm: 0 });
    a.agora.valor = 2 * HORA;
    a.rede.mockImplementationOnce(async () => ({ ok: false, status: 429, body: {}, retryAfter: 42 }));
    const resposta = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(resposta.retryAfter).toBe(42);
    expect(estadoPorStatus(resposta.status, resposta.retryAfter)).toEqual({ tipo: "limitada", esperaSegundos: 42 });
  });
});

describe("estado mostrado pelo status da API", () => {
  it("só 200 é conectada; 401, 403, 429 e falha têm tratamento próprio", () => {
    expect(estadoPorStatus(200)).toEqual({ tipo: "conectada" });
    expect(estadoPorStatus(401)).toEqual({ tipo: "expirada" });
    expect(estadoPorStatus(403)).toEqual({ tipo: "indisponivel" });
    expect(estadoPorStatus(429)).toEqual({ tipo: "limitada", esperaSegundos: 60 });
    expect(estadoPorStatus(0)).toEqual({ tipo: "falha" });
    expect(estadoPorStatus(503)).toEqual({ tipo: "falha" });
  });
});
