import { describe, expect, it } from "vitest";
import { criarConsulta, INTERVALO_SESSAO_MS, type ApiResult, type EstadoSessaoConteudo } from "../../../apps/browser-extension/src/content/consulta";
import type { EstadoGaveta } from "../../../apps/browser-extension/src/shared/types";

// Dados falsos: nenhum telefone ou nome real.
const LEAD_RESOLVIDO = {
  status: "FOUND",
  lead: { id: "lead-falso-0001", version: 2, name: "Cliente Exemplo", phoneMasked: "(11) 9****-0000", currentStatus: { id: "in_contact", label: "Em atendimento" }, origin: "site", unit: null, assignedUser: null, nextAction: null, qualification: { completed: [], missing: [] }, allowedActions: [] },
};

function ambiente() {
  let agora = 1_000_000;
  let conversa: { phone?: string } | null = { phone: "+5511900000001" };
  let pronto = true;
  let sessaoResposta: ApiResult = { ok: true, status: 200, body: {} };
  const respostasResolve: Array<ApiResult | Promise<ApiResult>> = [];
  const chamadas: string[] = [];
  const mostrados: EstadoGaveta[] = [];
  const sessoes: EstadoSessaoConteudo[] = [];
  let ocultou = 0;

  const consulta = criarConsulta({
    pronto: () => pronto,
    conversa: async () => conversa,
    requisitar: async (path) => {
      chamadas.push(path);
      if (path === "/api/extension/session") return sessaoResposta;
      return respostasResolve.shift() ?? { ok: true, status: 200, body: LEAD_RESOLVIDO };
    },
    mostrar: (estado) => { mostrados.push(estado); },
    ocultar: () => { ocultou++; },
    aoEstadoSessao: (estado) => { sessoes.push(estado); },
    agora: () => agora,
  });

  return {
    consulta,
    chamadas,
    mostrados,
    sessoes,
    get ocultou() { return ocultou; },
    responderResolve: (...respostas: Array<ApiResult | Promise<ApiResult>>) => respostasResolve.push(...respostas),
    setSessao: (resposta: ApiResult) => { sessaoResposta = resposta; },
    setConversa: (valor: { phone?: string } | null) => { conversa = valor; },
    avancar: (ms: number) => { agora += ms; },
    setPronto: (valor: boolean) => { pronto = valor; },
    ultimo: () => mostrados[mostrados.length - 1],
    resolves: () => chamadas.filter((c) => c === "/api/extension/leads/resolve").length,
  };
}

const esperar = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("consulta do lead no WhatsApp: privacidade e reconexão", () => {
  it("lead resolvido aparece com sessão válida", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    expect(a.ultimo()).toMatchObject({ tipo: "lead", lead: { name: "Cliente Exemplo" } });
  });

  it("401 no resolve limpa a tela: nenhum dado do lead fica visível", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    expect(a.ultimo()?.tipo).toBe("lead");
    const antes = a.mostrados.length;
    a.setSessao({ ok: false, status: 401, body: {} });
    a.responderResolve({ ok: false, status: 401, body: {} });
    a.avancar(INTERVALO_SESSAO_MS + 1);
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "sem-conexao" });
    // Depois do 401 só aparece a tela de conexão: nenhum estado com o lead.
    expect(JSON.stringify(a.mostrados.slice(antes))).not.toMatch(/Cliente Exemplo/);
  });

  it("sessão recusada na checagem: sem-conexao e aviso de sessão ausente", async () => {
    const a = ambiente();
    a.setSessao({ ok: false, status: 401, body: {} });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "sem-conexao" });
    expect(a.sessoes).toEqual(["sem-sessao"]);
    expect(a.resolves()).toBe(0);
  });

  it("403 mostra indisponível e nenhum dado", async () => {
    const a = ambiente();
    a.responderResolve({ ok: false, status: 403, body: {} });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "indisponivel" });
  });

  it("reconectar na mesma conversa refaz a consulta (não reaproveita a resposta antiga)", async () => {
    const a = ambiente();
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(1);
    a.consulta.invalidar();
    a.responderResolve({ ok: true, status: 200, body: LEAD_RESOLVIDO });
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(2);
    expect(a.ultimo()).toMatchObject({ tipo: "lead" });
  });

  it("resposta atrasada depois de invalidar é descartada", async () => {
    const a = ambiente();
    let liberar: (r: ApiResult) => void = () => undefined;
    a.responderResolve(new Promise<ApiResult>((resolve) => { liberar = resolve; }));
    const pendente = a.consulta.sincronizar();
    await esperar();
    a.consulta.invalidar();
    liberar({ ok: true, status: 200, body: LEAD_RESOLVIDO });
    await pendente;
    expect(a.ultimo()).toEqual({ tipo: "carregando" });
  });

  it("troca de conversa descarta a resposta da conversa anterior", async () => {
    const a = ambiente();
    let liberar: (r: ApiResult) => void = () => undefined;
    a.responderResolve(new Promise<ApiResult>((resolve) => { liberar = resolve; }));
    const primeira = a.consulta.sincronizar();
    await esperar();
    a.setConversa({ phone: "+5511900000002" });
    liberar({ ok: true, status: 200, body: LEAD_RESOLVIDO });
    await primeira;
    expect(a.ultimo()).toEqual({ tipo: "carregando" });
  });
});

describe("consulta: limites e pausas", () => {
  it("429 pausa pelo Retry-After e não consulta de novo antes", async () => {
    const a = ambiente();
    a.responderResolve({ ok: false, status: 429, body: {}, retryAfter: 30 });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "erro" });
    a.avancar(10_000);
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(1);
    a.avancar(21_000);
    a.responderResolve({ ok: true, status: 200, body: LEAD_RESOLVIDO });
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(2);
  });

  it("falha de rede mostra erro e pausa antes de tentar de novo", async () => {
    const a = ambiente();
    a.responderResolve({ ok: false, status: 0, body: {} });
    await a.consulta.sincronizar();
    expect(a.ultimo()).toEqual({ tipo: "erro" });
    a.avancar(1_000);
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(1);
  });

  it("sem conversa identificada, oculta a gaveta", async () => {
    const a = ambiente();
    a.setConversa(null);
    await a.consulta.sincronizar();
    expect(a.ocultou).toBeGreaterThan(0);
  });

  it("nada acontece quando a página do WhatsApp ainda não está pronta", async () => {
    const a = ambiente();
    a.setPronto(false);
    await a.consulta.sincronizar();
    expect(a.resolves()).toBe(0);
    expect(a.ocultou).toBeGreaterThan(0);
  });
});
