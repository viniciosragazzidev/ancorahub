import { describe, expect, it } from "vitest";

import { chavePedidoReconexao, classificarSituacao, faixaWhatsAppEquipe, ordenarLinhas, resultadoTentativa, type SituacaoWhatsApp } from "./situacao";

const conectouEm = new Date("2026-11-20T12:00:00Z");

describe("classificarSituacao", () => {
  it("sem conexão salva é nunca conectou", () => {
    expect(classificarSituacao(null)).toBe("nunca");
  });
  it("ready, em qualquer grafia, é conectado", () => {
    expect(classificarSituacao({ status: "ready", connectedAt: conectouEm })).toBe("conectado");
    expect(classificarSituacao({ status: "WORKING", connectedAt: null })).toBe("conectado");
  });
  it("pareando é escaneie o QR, tenha conectado antes ou não", () => {
    expect(classificarSituacao({ status: "initializing", connectedAt: null })).toBe("qr");
    expect(classificarSituacao({ status: "SCAN_QR_CODE", connectedAt: conectouEm })).toBe("qr");
  });
  it("erro, desconectado ou pausado depois de já ter conectado é caiu", () => {
    expect(classificarSituacao({ status: "error", connectedAt: conectouEm })).toBe("caiu");
    expect(classificarSituacao({ status: "disconnected", connectedAt: "2026-11-20T12:00:00Z" })).toBe("caiu");
    expect(classificarSituacao({ status: "paused", connectedAt: conectouEm })).toBe("caiu");
  });
  it("erro sem nunca ter conectado é nunca conectou", () => {
    expect(classificarSituacao({ status: "error", connectedAt: null })).toBe("nunca");
    expect(classificarSituacao({ status: null, connectedAt: null })).toBe("nunca");
  });
});

const linha = (nome: string, situacao: SituacaoWhatsApp, desde: string | null = null) => ({ nome, situacao, desde });

describe("ordenarLinhas", () => {
  it("põe quem caiu primeiro, depois QR, nunca conectou e conectado", () => {
    const ordem = ordenarLinhas([linha("Ana", "conectado"), linha("Bia", "nunca"), linha("Caio", "qr"), linha("Davi", "caiu")]);
    expect(ordem.map((item) => item.nome)).toEqual(["Davi", "Caio", "Bia", "Ana"]);
  });
  it("dentro do grupo, quem está assim há mais tempo vem antes; sem data vai para o fim", () => {
    const ordem = ordenarLinhas([
      linha("Zé", "caiu", "2026-11-25T10:00:00Z"),
      linha("Ana", "caiu", null),
      linha("Bia", "caiu", "2026-11-25T08:00:00Z"),
      linha("Caio", "caiu", "2026-11-25T08:00:00Z"),
    ]);
    expect(ordem.map((item) => item.nome)).toEqual(["Bia", "Caio", "Zé", "Ana"]);
  });
});

describe("faixaWhatsAppEquipe", () => {
  const equipe = (sem: number, total: number) => Array.from({ length: total }, (_, i) => ({ situacao: (i < sem ? "caiu" : "conectado") as SituacaoWhatsApp }));

  it("aparece acima de 20% sem WhatsApp", () => {
    expect(faixaWhatsAppEquipe(equipe(5, 18))).toEqual({ mostrar: true, sem: 5, total: 18, texto: "5 de 18 corretores estão sem WhatsApp agora" });
  });
  it("não aparece com exatamente 20% nem abaixo", () => {
    expect(faixaWhatsAppEquipe(equipe(2, 10)).mostrar).toBe(false);
    expect(faixaWhatsAppEquipe(equipe(0, 10)).mostrar).toBe(false);
  });
  it("não aparece sem corretores", () => {
    expect(faixaWhatsAppEquipe([]).mostrar).toBe(false);
  });
  it("concorda singular e plural", () => {
    expect(faixaWhatsAppEquipe(equipe(1, 4)).texto).toBe("1 de 4 corretores está sem WhatsApp agora");
    expect(faixaWhatsAppEquipe(equipe(1, 1)).texto).toBe("1 de 1 corretor está sem WhatsApp agora");
  });
  it("conta QR e nunca conectou como sem WhatsApp", () => {
    expect(faixaWhatsAppEquipe([{ situacao: "qr" }, { situacao: "nunca" }, { situacao: "conectado" }]).sem).toBe(2);
  });
});

describe("apoio", () => {
  it("lê o resultado gravado pelo vigia", () => {
    expect(resultadoTentativa({ resultado: "ok" })).toBe("ok");
    expect(resultadoTentativa({ resultado: "erro" })).toBe("erro");
    expect(resultadoTentativa(null)).toBe("erro");
  });
  it("um pedido de reconexão por corretor por hora", () => {
    expect(chavePedidoReconexao("u1", new Date("2026-11-25T14:59:00Z"))).toBe("whatsapp-reconexao-pedido:u1:2026-11-25T14");
  });
});
