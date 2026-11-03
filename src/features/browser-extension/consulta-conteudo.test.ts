import { describe, expect, it } from "vitest";
import { criarConsulta, INTERVALO_SESSAO_MS, type ApiResult } from "../../../apps/browser-extension/src/content/consulta";
import type { EstadoGaveta } from "../../../apps/browser-extension/src/shared/types";

// Dados falsos: nenhum telefone ou nome real. "gen-A" e "gen-B" são sessões de teste.
const LEAD = {
  status: "FOUND",
  lead: { id: "lead-falso-0001", version: 2, name: "Cliente Exemplo", phoneMasked: "(11) 9****-0000", currentStatus: { id: "in_contact", label: "Em atendimento" }, origin: "site", unit: null, assignedUser: null, nextAction: null, qualification: { completed: [], missing: [] }, allowedActions: [] },
};

const esperar = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function ambiente() {
  let agora = 1_000_000;
  let conversa: { phone?: string } | null = { phone: "+5511900000001" };
  let pronto = true;
  let sessao: ApiResult = { ok: true, status: 200, body: {}, geracao: "gen-A" };
  const resolves: Array<ApiResult | Promise<ApiResult>> = [];
  const chamadas: string[] = [];
  const mostrados: EstadoGaveta[] = [];
  let ocultou = 0;
  let neutro = 0;

  const consulta = criarConsulta({
    pronto: () => pronto,
    conversa: async () => conversa,
    requisitar: async (path) => {
      chamadas.push(path);
      if (path === "/api/extension/session") return sessao;
      return resolves.shift() ?? { ok: true, status: 200, body: LEAD, geracao: "gen-A" };
    },
    mostrar: (estado) => { mostrados.push(estado); },
    ocultar: () => { ocultou++; },
    neutro: () => { neutro++; },
    aoEstadoSessao: () => undefined,
    agora: () => agora,
  });

  return {
    consulta,
    mostrados,
    get ocultou() { return ocultou; },
    get neutro() { return neutro; },
    resolve: (...respostas: Array<ApiResult | Promise<ApiResult>>) => resolves.push(...respostas),
    setSessao: (resposta: ApiResult) => { sessao = resposta; },
    setConversa: (valor: { phone?: string } | null) => { conversa = valor; },
    avancar: (ms: number) => { agora += ms; },
    setPronto: (valor: boolean) => { pronto = valor; },
    ultimo: () => mostrados[mostrados.length - 1],
    resolves: () => chamadas.filter((c) => c === "/api/extension/leads/resolve").length,
    chamadas,
  };
}

describe("consulta: privacidade e reconexão", () => {
  it("lead resolvido aparece com sessão válida", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    expect(a.ultimo()).toMatchObject({ tipo: "lead", lead: { name: "Cliente Exemplo" } });
  });

  it("403 na checagem com lead em cache: sai o lead e mostra indisponível", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    expect(a.ultimo()?.tipo).toBe("lead");
    const antes = a.mostrados.length;
    a.avancar(INTERVALO_SESSAO_MS + 1);
    a.setSessao({ ok: false, status: 403, body: {}, geracao: null });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "indisponivel" });
    expect(JSON.stringify(a.mostrados.slice(antes))).not.toMatch(/Cliente Exemplo/);
  });

  it("sessão desconhecida (rede) não reapresenta o lead em cache", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    a.avancar(INTERVALO_SESSAO_MS + 1);
    a.setSessao({ ok: false, status: 0, body: {}, geracao: null });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "erro" });
  });

  it("invalidar com lead visível e rede pendente: esconde na hora e descarta a resposta atrasada", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    let liberar: (r: ApiResult) => void = () => undefined;
    a.resolve(new Promise<ApiResult>((resolve) => { liberar = resolve; }));
    a.setConversa({ phone: "+5511900000002" });
    const pendente = a.consulta.sincronizar();
    await esperar();
    a.consulta.invalidar();
    expect(a.neutro).toBe(1);
    liberar({ ok: true, status: 200, body: LEAD, geracao: "gen-A" });
    await pendente;
    expect(a.ultimo()).toEqual({ tipo: "carregando" });
  });

  it("401 antigo depois de sessão nova não derruba a sessão nova", async () => {
    const a = ambiente();
    let liberar: (r: ApiResult) => void = () => undefined;
    a.resolve(new Promise<ApiResult>((resolve) => { liberar = resolve; }));
    const pendente = a.consulta.sincronizar();
    await esperar();
    a.consulta.invalidar();
    a.setSessao({ ok: true, status: 200, body: {}, geracao: "gen-B" });
    liberar({ ok: false, status: 401, body: {}, geracao: "gen-A" });
    await pendente;
    expect(a.mostrados.some((estado) => estado.tipo === "sem-conexao")).toBe(false);
  });

  it("reconectar na mesma conversa refaz a consulta do lead", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(1);
    a.consulta.invalidar();
    // Nova sessão confirmada pela checagem: a consulta da mesma conversa é refeita com ela.
    a.setSessao({ ok: true, status: 200, body: {}, geracao: "gen-B" });
    a.resolve({ ok: true, status: 200, body: LEAD, geracao: "gen-B" });
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(2);
    expect(a.ultimo()).toMatchObject({ tipo: "lead" });
  });

  it("401 da sessão atual limpa a tela e mostra conexão, sem dados do lead", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    a.resolve({ ok: false, status: 401, body: {}, geracao: "gen-A" });
    a.setConversa({ phone: "+5511900000003" });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "sem-conexao" });
  });

  it("sessão recusada na checagem: sem-conexao, sem consultar o lead", async () => {
    const a = ambiente();
    a.setSessao({ ok: false, status: 401, body: {}, geracao: null });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "sem-conexao" });
    expect(a.resolves()).toBe(0);
  });
});

describe("consulta: limites e pausas", () => {
  it("429 pausa pelo Retry-After e não consulta antes", async () => {
    const a = ambiente();
    a.resolve({ ok: false, status: 429, body: {}, retryAfter: 30, geracao: "gen-A" });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "erro" });
    a.avancar(10_000);
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(1);
  });

  it("sem conversa identificada, oculta a gaveta", async () => {
    const a = ambiente();
    a.setConversa(null);
    await a.consulta.sincronizar();
    expect(a.ocultou).toBeGreaterThan(0);
  });

  it("página não pronta não consulta nada", async () => {
    const a = ambiente();
    a.setPronto(false);
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(0);
  });
});
