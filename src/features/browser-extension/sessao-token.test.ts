import { describe, expect, it, vi } from "vitest";
import { criarCredencialStore, type Armazenamento, type Credencial } from "../../../apps/browser-extension/src/background/credencial";
import { chamarApi, credencialVigente, ROTACAO_APOS_MS, type Dependencias, type Metodo, type RespostaApi } from "../../../apps/browser-extension/src/background/sessao-token";
import { estadoPorStatus } from "../../../apps/browser-extension/src/shared/estado-sessao";

const HORA = 60 * 60_000;
let contador = 0;

// Tokens e gerações falsos: nenhum valor real. O crypto.randomUUID é o do próprio ambiente de teste.
function ambiente(inicial: Credencial | null, tempo = { agora: 0 }) {
  let guardado: Credencial | null = inicial;
  const armazem: Armazenamento = {
    ler: async () => (guardado ? { ...guardado } : null),
    gravar: async (valor) => { guardado = valor ? { ...valor } : null; },
  };
  const store = criarCredencialStore(armazem);
  const chamadas: Array<{ path: string; method: Metodo; token: string | null }> = [];
  const respostas: Array<(token: string | null) => RespostaApi> = [];
  const rede = vi.fn(async (path: string, method: Metodo, token: string | null): Promise<RespostaApi> => {
    chamadas.push({ path, method, token });
    const proxima = respostas.shift();
    if (proxima) return proxima(token);
    if (path === "/api/extension/session" && method === "POST") return { ok: true, status: 200, body: { token: `rotacionado-${++contador}` } };
    return { ok: true, status: 200, body: { path } };
  });
  const deps: Dependencias = { store, rede, agora: () => tempo.agora };
  return { deps, rede, chamadas, respostas, store, atual: () => guardado, tempo };
}

const sessao = (token: string, geracao: string, tokenEm = 0): Credencial => ({ geracao, token, tokenEm, perfil: null });

describe("credencial do worker: uma geração por sessão", () => {
  it("rotação de uma sessão antiga não grava o token sobre a conta conectada depois", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: ROTACAO_APOS_MS + 1 });
    // A rotação de A fica em voo; enquanto isso, a conta B conecta.
    let liberar: (r: RespostaApi) => void = () => undefined;
    a.rede.mockImplementationOnce(() => new Promise<RespostaApi>((resolve) => { liberar = resolve; }));
    const pendente = credencialVigente(a.deps);
    await a.store.trocar("token-B", null, a.tempo.agora);
    liberar({ ok: true, status: 200, body: { token: "token-A-renovado" } });
    await pendente;
    expect(a.atual()?.token).not.toBe("token-A-renovado");
    expect(a.atual()?.geracao).not.toBe("gen-A");
  });

  it("401 da conta A depois de conectar B não apaga a sessão B", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: HORA });
    await a.store.trocar("token-B", null, HORA);
    const geracaoB = a.atual()!.geracao;
    const removeu = await a.store.sairSe("gen-A");
    expect(removeu).toBe(false);
    expect(a.atual()?.geracao).toBe(geracaoB);
  });
});

describe("chamadas à API pelo worker", () => {
  it("dentro de 24 h usa a sessão atual e não rotaciona", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: 2 * HORA });
    const r = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST", { phone: "x" });
    expect(r.geracao).toBe("gen-A");
    expect(a.chamadas.filter((c) => c.path === "/api/extension/session")).toHaveLength(0);
  });

  it("depois de 24 h rotaciona, grava o token da mesma geração e usa o novo", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: ROTACAO_APOS_MS + 1 });
    await chamarApi(a.deps, "/api/extension/inbox", "GET");
    expect(a.atual()).toMatchObject({ geracao: "gen-A", tokenEm: ROTACAO_APOS_MS + 1 });
    expect(a.chamadas.at(-1)?.token).toMatch(/^rotacionado-/);
  });

  it("várias chamadas simultâneas da mesma sessão compartilham uma rotação", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: ROTACAO_APOS_MS + 1 });
    await Promise.all([1, 2, 3, 4, 5].map((n) => chamarApi(a.deps, `/api/extension/leads/${n}`, "GET")));
    expect(a.chamadas.filter((c) => c.path === "/api/extension/session")).toHaveLength(1);
  });

  it("401 da rotação descarta só a própria sessão", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: ROTACAO_APOS_MS + 1 });
    a.respostas.push(() => ({ ok: false, status: 401, body: {} }));
    const r = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(r.status).toBe(401);
    expect(a.atual()).toBeNull();
  });

  it("falha transitória na rotação mantém a sessão atual", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: ROTACAO_APOS_MS + 1 });
    a.respostas.push(() => ({ ok: false, status: 0, body: {} }));
    await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(a.atual()?.token).toBe("token-A");
  });

  it("401 com a MESMA sessão já rotacionada tenta de novo com o token novo", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: 2 * HORA });
    a.rede.mockImplementationOnce(async () => {
      await a.store.rotacionar("gen-A", "token-A-novo", 2 * HORA);
      return { ok: false, status: 401, body: {} };
    });
    const r = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(r.ok).toBe(true);
    expect(a.chamadas.at(-1)?.token).toBe("token-A-novo");
  });

  it("replay proibido entre contas: 401 com a sessão trocada não repete o pedido com a conta nova", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: 2 * HORA });
    a.rede.mockImplementationOnce(async () => {
      await a.store.trocar("token-B", null, 2 * HORA);
      return { ok: false, status: 401, body: {} };
    });
    const r = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(r.status).toBe(401);
    expect(a.chamadas.filter((c) => c.token === "token-B")).toHaveLength(0);
    expect(a.atual()?.token).toBe("token-B");
  });

  it("PATCH chega ao CRM como PATCH (não vira GET)", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: HORA });
    await chamarApi(a.deps, "/api/extension/leads/lead-1/status", "PATCH", { statusId: "in_contact" });
    expect(a.chamadas.at(-1)?.method).toBe("PATCH");
  });

  it("429 devolve o Retry-After para a tela", async () => {
    const a = ambiente(sessao("token-A", "gen-A", 0), { agora: HORA });
    a.respostas.push(() => ({ ok: false, status: 429, body: {}, retryAfter: 42 }));
    const r = await chamarApi(a.deps, "/api/extension/leads/resolve", "POST");
    expect(estadoPorStatus(r.status, r.retryAfter)).toEqual({ tipo: "limitada", esperaSegundos: 42 });
  });
});
