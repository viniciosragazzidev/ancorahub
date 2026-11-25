import { describe, expect, it } from "vitest";

import {
  buildProposalWhatsAppMessage,
  canSendProposalOnWhatsApp,
  DEFAULT_PROPOSAL_VALID_DAYS,
  defaultValidUntilInput,
  leadFirstName,
  parseProposalValidDays,
  proposalAttention,
  proposalDefaultsKeys,
  proposalPublicPath,
  resolveProposalDefaults,
  sortProposalsByAttention,
  summarizeProposalAttention,
  validUntilFromDateInput,
} from "./proposal-rules";
import type { ProposalStatus } from "@/shared/db/schema";

const DAY = 24 * 60 * 60 * 1000;

describe("mensagem do WhatsApp da proposta", () => {
  it("usa o primeiro nome, o plano, a validade em dd/mm de São Paulo e o link na linha de baixo", () => {
    const text = buildProposalWhatsAppMessage({
      leadName: "  ana   maria souza ",
      planName: "Amil S380 QC",
      validUntil: new Date("2026-11-30T23:59:59-03:00"),
      link: "https://crm.exemplo.test/api/quotes/tok/pdf",
    });
    expect(text).toBe("Olá Ana, segue sua proposta do plano Amil S380 QC, válida até 30/11.\nhttps://crm.exemplo.test/api/quotes/tok/pdf");
    expect(text).not.toContain("—");
  });

  it("sem plano ou sem nome a frase continua curta e correta", () => {
    const validUntil = new Date("2026-12-05T23:59:59-03:00");
    expect(buildProposalWhatsAppMessage({ leadName: "Carlos", planName: null, validUntil, link: "L" })).toBe("Olá Carlos, segue sua proposta, válida até 05/12.\nL");
    expect(buildProposalWhatsAppMessage({ leadName: "", planName: "  ", validUntil, link: "L" })).toBe("Olá, segue sua proposta, válida até 05/12.\nL");
  });

  it("a validade gravada à meia-noite UTC não vira o dia seguinte nem o anterior por engano", () => {
    // 01/12 03:00 UTC é 01/12 00:00 em São Paulo.
    expect(buildProposalWhatsAppMessage({ leadName: "Ana", validUntil: new Date("2026-12-01T03:00:00Z"), link: "L" })).toContain("válida até 01/12.");
  });

  it("primeiro nome em maiúscula inicial", () => {
    expect(leadFirstName("joão da silva")).toBe("João");
    expect(leadFirstName(null)).toBe("");
  });

  it("link público só existe com cotação vinculada", () => {
    expect(proposalPublicPath("abc")).toBe("/api/quotes/abc/pdf");
    expect(proposalPublicPath(null)).toBeNull();
  });

  it("só rascunho e enviada vão pelo WhatsApp", () => {
    const allowed = (["rascunho", "em_revisao", "enviada", "visualizada", "negociacao", "aprovada", "perdida", "expirada"] as ProposalStatus[]).filter(canSendProposalOnWhatsApp);
    expect(allowed).toEqual(["rascunho", "enviada"]);
  });
});

describe("validade padrão da corretora", () => {
  it("soma os dias ao dia de hoje em São Paulo", () => {
    expect(defaultValidUntilInput(7, new Date("2026-11-25T15:00:00Z"))).toBe("2026-12-02");
    // 26/11 01:00 UTC ainda é 25/11 em São Paulo.
    expect(defaultValidUntilInput(10, new Date("2026-11-26T01:00:00Z"))).toBe("2026-12-05");
    expect(defaultValidUntilInput(1, new Date("2026-12-31T12:00:00Z"))).toBe("2027-01-01");
  });

  it("valor inválido volta para o padrão do sistema", () => {
    expect(defaultValidUntilInput(0, new Date("2026-11-25T15:00:00Z"))).toBe(defaultValidUntilInput(DEFAULT_PROPOSAL_VALID_DAYS, new Date("2026-11-25T15:00:00Z")));
    expect(parseProposalValidDays("15")).toBe(15);
    expect(parseProposalValidDays("0")).toBeNull();
    expect(parseProposalValidDays("91")).toBeNull();
    expect(parseProposalValidDays("7.5")).toBeNull();
    expect(parseProposalValidDays(null)).toBeNull();
  });

  it("resolve o que está salvo para a empresa, com padrão quando vazio", () => {
    expect(resolveProposalDefaults({})).toEqual({ validDays: DEFAULT_PROPOSAL_VALID_DAYS, conditions: "" });
    expect(resolveProposalDefaults({ validDays: "15", conditions: "  Carência conforme contrato. " })).toEqual({ validDays: 15, conditions: "Carência conforme contrato." });
    expect(proposalDefaultsKeys("t1")).toEqual({ validDays: "proposals_default_valid_days_t1", conditions: "proposals_default_conditions_t1" });
  });

  it("a data do campo vale até o fim do dia em São Paulo", () => {
    const date = validUntilFromDateInput("2026-12-02");
    expect(date?.toISOString()).toBe("2026-12-03T02:59:59.000Z");
    expect(validUntilFromDateInput("2026-02-30")).toBeNull();
    expect(validUntilFromDateInput("")).toBeNull();
  });
});

describe("ordem por atenção", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  const rows = [
    { id: "a", status: "enviada" as ProposalStatus, validUntil: at(20) },
    { id: "b", status: "negociacao" as ProposalStatus, validUntil: at(2) },
    { id: "c", status: "em_revisao" as ProposalStatus, validUntil: at(30) },
    { id: "d", status: "rascunho" as ProposalStatus, validUntil: at(1) },
    { id: "e", status: "aprovada" as ProposalStatus, validUntil: at(1) },
    { id: "f", status: "enviada" as ProposalStatus, validUntil: at(5) },
    { id: "g", status: "visualizada" as ProposalStatus, validUntil: at(-1) },
  ];

  it("em revisão primeiro, depois as que expiram em até 3 dias, o resto na ordem de antes", () => {
    expect(sortProposalsByAttention(rows, now).map((row) => row.id)).toEqual(["c", "d", "b", "a", "e", "f", "g"]);
  });

  it("encerrada ou já vencida não pede ação", () => {
    expect(proposalAttention(rows[4]!, now)).toBeNull();
    expect(proposalAttention(rows[6]!, now)).toBeNull();
    expect(proposalAttention(rows[3]!, now)).toBe("expiring");
  });

  it("resumo do topo conta em revisão e o que expira esta semana", () => {
    expect(summarizeProposalAttention(rows, now)).toBe("1 em revisão e 3 expiram esta semana");
    expect(summarizeProposalAttention([rows[1]!], now)).toBe("1 expira esta semana");
    expect(summarizeProposalAttention([rows[0]!, rows[4]!], now)).toBeNull();
  });
});
