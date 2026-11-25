import { describe, expect, it } from "vitest";

import { canMarkLost, nextStageFor, stageActorFor } from "./lead-card-stage";

const lead = { status: "quote_sent", branchId: "b-1", corretorId: "c-1" };

describe("quem move o lead pelo ⋯ do cartão", () => {
  it("diretor sempre pela gestão; gestor só na unidade dele", () => {
    expect(stageActorFor("director", lead)).toBe("management");
    expect(stageActorFor("manager", lead, { branchId: "b-1" })).toBe("management");
    expect(stageActorFor("manager", lead, { branchId: "b-2" })).toBe("none");
  });

  it("corretor dono, menos em lead distribuído que ainda não começou", () => {
    expect(stageActorFor("broker", lead)).toBe("owner");
    expect(stageActorFor("broker", { ...lead, status: "distributed" })).toBe("none");
    expect(stageActorFor("broker", { ...lead, corretorId: null })).toBe("none");
  });

  it("supervisor e outros papéis não mexem na etapa pelo cartão", () => {
    expect(stageActorFor("supervisor", lead, { branchId: "b-1" })).toBe("none");
  });
});

describe("próxima etapa sugerida", () => {
  it("segue a sugestão de hoje e grava na hora", () => {
    expect(nextStageFor("quote_sent", "owner")).toEqual({ status: "negotiation", mode: "direct" });
    expect(nextStageFor("negotiation", "management")).toEqual({ status: "documentation_pending", mode: "direct" });
  });

  it("Entrei em contato pede o relato e só o dono registra", () => {
    expect(nextStageFor("in_contact", "owner")).toEqual({ status: "contacted", mode: "note" });
    expect(nextStageFor("in_contact", "management")).toBeNull();
  });

  it("Convertido abre a ficha para registrar a venda", () => {
    expect(nextStageFor("under_analysis", "owner")).toEqual({ status: "converted", mode: "page" });
  });

  it("sem sugestão ou sem papel, sem próxima etapa", () => {
    expect(nextStageFor("converted", "owner")).toBeNull();
    expect(nextStageFor("awaiting_reply", "owner")).toBeNull();
    expect(nextStageFor("quote_sent", "none")).toBeNull();
  });

  it("perdido só quando a máquina de estados deixa", () => {
    expect(canMarkLost("negotiation", "owner")).toBe(true);
    expect(canMarkLost("lost", "management")).toBe(false);
    expect(canMarkLost("negotiation", "none")).toBe(false);
  });
});
