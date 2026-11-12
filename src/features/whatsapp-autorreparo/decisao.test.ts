import { describe, expect, it } from "vitest";
import {
  avisoDeVesperaLiberado,
  chaveAvisoReconexao,
  dataPlantaoDeAmanha,
  dataSaoPaulo,
  decidirAcaoVigia,
  horaAvisoValida,
  horaSaoPaulo,
  proximoStartPermitidoEm,
  HORA_AVISO_PADRAO,
  LIMITE_STARTS_DIA,
  type EntradaVigia,
} from "./decisao";

const agora = new Date("2026-11-12T15:00:00Z"); // 12/11 12h em São Paulo
const base: EntradaVigia = {
  statusCrm: "error",
  statusRelay: "ERROR",
  jaConectou: true,
  startsHoje: 0,
  ultimoStartEm: null,
  agora,
  startHabilitado: true,
};

describe("decidirAcaoVigia", () => {
  it("sincroniza ready quando o relay diz CONNECTED e o CRM não", () => {
    expect(decidirAcaoVigia({ ...base, statusRelay: "CONNECTED" })).toEqual({ tipo: "sincronizar", status: "ready" });
  });

  it("não mexe quando o CRM já está ready", () => {
    expect(decidirAcaoVigia({ ...base, statusCrm: "ready", statusRelay: "CONNECTED" }).tipo).toBe("nada");
  });

  it("nunca faz start em conexão que nunca conectou: pede QR", () => {
    expect(decidirAcaoVigia({ ...base, jaConectou: false })).toEqual({ tipo: "aguardar", motivo: "nunca conectou: precisa de QR" });
  });

  it("faz start em sessão que já conectou e está em ERROR, com a flag ligada", () => {
    expect(decidirAcaoVigia(base)).toEqual({ tipo: "start" });
  });

  it("com a flag desligada, não faz start", () => {
    expect(decidirAcaoVigia({ ...base, startHabilitado: false })).toEqual({ tipo: "nada", motivo: "start desligado (flag)" });
  });

  it("respeita o limite diário de starts", () => {
    expect(decidirAcaoVigia({ ...base, startsHoje: LIMITE_STARTS_DIA })).toEqual({ tipo: "nada", motivo: "limite diário de starts" });
  });

  it("respeita o backoff: 1 min após a primeira tentativa", () => {
    const umMinutoAtras = new Date(agora.getTime() - 60_000);
    expect(decidirAcaoVigia({ ...base, startsHoje: 1, ultimoStartEm: umMinutoAtras })).toEqual({ tipo: "start" });
    const trintaSegundosAtras = new Date(agora.getTime() - 30_000);
    expect(decidirAcaoVigia({ ...base, startsHoje: 1, ultimoStartEm: trintaSegundosAtras })).toEqual({ tipo: "nada", motivo: "aguardando backoff" });
  });

  it("não mexe em sessão que está pareando no relay", () => {
    expect(decidirAcaoVigia({ ...base, statusRelay: "SCAN_QR_CODE" }).tipo).toBe("nada");
    expect(decidirAcaoVigia({ ...base, statusRelay: "STARTING" }).tipo).toBe("nada");
  });

  it("sem resposta do relay, não faz nada", () => {
    expect(decidirAcaoVigia({ ...base, statusRelay: null })).toEqual({ tipo: "nada", motivo: "relay sem resposta" });
  });

  it("nunca devolve uma ação de recover ou delete", () => {
    const acoes = [
      decidirAcaoVigia(base),
      decidirAcaoVigia({ ...base, jaConectou: false }),
      decidirAcaoVigia({ ...base, statusRelay: "CONNECTED" }),
      decidirAcaoVigia({ ...base, startsHoje: 9 }),
    ];
    for (const acao of acoes) expect(["sincronizar", "start", "aguardar", "nada"]).toContain(acao.tipo);
  });
});

describe("proximoStartPermitidoEm", () => {
  it("usa 1, 5 e depois 15 minutos", () => {
    const ultimo = new Date("2026-11-12T15:00:00Z");
    expect(proximoStartPermitidoEm({ startsHoje: 1, ultimoStartEm: ultimo }).getTime() - ultimo.getTime()).toBe(60_000);
    expect(proximoStartPermitidoEm({ startsHoje: 2, ultimoStartEm: ultimo }).getTime() - ultimo.getTime()).toBe(5 * 60_000);
    expect(proximoStartPermitidoEm({ startsHoje: 3, ultimoStartEm: ultimo }).getTime() - ultimo.getTime()).toBe(15 * 60_000);
  });
});

describe("aviso de véspera (um dia antes do plantão, a partir da hora configurada)", () => {
  it("usa o dia seguinte como data do plantão, em São Paulo", () => {
    // 12/11 às 21h30 em SP = 13/11 00h30 UTC: o plantão de amanhã é 13/11 (em SP).
    expect(dataPlantaoDeAmanha(new Date("2026-11-13T00:30:00Z"))).toBe("2026-11-13");
    expect(dataPlantaoDeAmanha(agora)).toBe("2026-11-13");
  });

  it("libera o aviso a partir das 18h de São Paulo e não antes", () => {
    expect(horaSaoPaulo(new Date("2026-11-12T20:59:00Z"))).toBe(17);
    expect(avisoDeVesperaLiberado(new Date("2026-11-12T20:59:00Z"), HORA_AVISO_PADRAO)).toBe(false);
    expect(avisoDeVesperaLiberado(new Date("2026-11-12T21:00:00Z"), HORA_AVISO_PADRAO)).toBe(true);
  });

  it("a data de São Paulo vira à meia-noite local, não em UTC", () => {
    expect(dataSaoPaulo(new Date("2026-11-13T02:30:00Z"))).toBe("2026-11-12");
  });

  it("a chave de idempotência é por corretor e por plantão", () => {
    expect(chaveAvisoReconexao("u1", "2026-11-13")).toBe("whatsapp-reconexao:u1:2026-11-13");
    expect(chaveAvisoReconexao("u1", "2026-11-13")).not.toBe(chaveAvisoReconexao("u1", "2026-11-14"));
  });

  it("hora configurada inválida volta ao padrão de 18h", () => {
    expect(horaAvisoValida("17")).toBe(17);
    expect(horaAvisoValida("25")).toBe(HORA_AVISO_PADRAO);
    expect(horaAvisoValida("abc")).toBe(HORA_AVISO_PADRAO);
    expect(horaAvisoValida(null)).toBe(HORA_AVISO_PADRAO);
  });
});
