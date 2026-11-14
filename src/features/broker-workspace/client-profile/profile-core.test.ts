import { describe, expect, it } from "vitest";

import {
  brokerProfileCanAct,
  buildProfileSummary,
  buildProfileTimeline,
  countByFilter,
  filterTimeline,
  parseProfileTab,
  parseTimelineFilter,
  profileOrigin,
  profileSituation,
  shouldUseBrokerClientProfile,
  summarizeContent,
  type ProfileActiveCustomer,
} from "./profile-core";

const contract: ProfileActiveCustomer = {
  status: "active",
  coverageStartDate: "2026-09-20",
  contractAnniversary: "2027-09-20",
  expirationDate: null,
  renewalStatus: "pending_window",
  cancellationDate: null,
  cancellationReason: null,
};

const interactions = [
  { id: "n1", tipo: "note", conteudo: "Cliente pediu boleto", userName: "Paulo Dias", createdAt: "2026-11-10T13:00:00Z" },
  { id: "s1", tipo: "status_change", conteudo: "Etapa: Venda", userName: "Paulo Dias", createdAt: "2026-11-09T13:00:00Z" },
  { id: "d1", tipo: "document_upload", conteudo: "RG enviado", userName: "Paulo Dias", createdAt: "2026-11-08T13:00:00Z" },
  { id: "q1", tipo: "quote_generated", conteudo: "Cotação Plano Essencial", userName: "Paulo Dias", createdAt: "2026-11-07T13:00:00Z" },
];
const sales = [{ id: "v1", planName: "Essencial", carrierName: "Operadora X", saleValue: "350.5", policyNumber: "APL-9", status: "active", saleDate: new Date("2026-11-11T12:00:00Z"), brokerName: "Paulo Dias" }];

describe("linha do tempo do perfil", () => {
  it("junta interações e vendas, mais recente primeiro, com autor, data, tipo e conteúdo", () => {
    const timeline = buildProfileTimeline({ interactions, sales, activeCustomer: contract });
    expect(timeline.map((entry) => entry.id)).toEqual(["s:v1", "i:n1", "i:s1", "i:d1", "i:q1"]);
    expect(timeline[0]).toMatchObject({ kind: "contrato", label: "Venda registrada", author: "Paulo Dias", automatic: false });
    expect(timeline[0].content).toContain("Operadora X · Essencial");
    expect(timeline.find((entry) => entry.id === "i:s1")).toMatchObject({ kind: "sistema", automatic: true, label: "Mudança de etapa" });
  });

  it("filtra por Tudo, Atendimentos, Observações, Contratos e Documentos", () => {
    const timeline = buildProfileTimeline({ interactions, sales, activeCustomer: contract });
    expect(filterTimeline(timeline, "tudo")).toHaveLength(5);
    expect(filterTimeline(timeline, "observacoes").map((entry) => entry.id)).toEqual(["i:n1"]);
    expect(filterTimeline(timeline, "atendimentos").map((entry) => entry.id)).toEqual(["i:q1"]);
    expect(filterTimeline(timeline, "contratos").map((entry) => entry.id)).toEqual(["s:v1"]);
    expect(filterTimeline(timeline, "documentos").map((entry) => entry.id)).toEqual(["i:d1"]);
    expect(countByFilter(timeline)).toEqual({ tudo: 5, atendimentos: 1, observacoes: 1, contratos: 1, documentos: 1 });
  });

  it("cancelamento do contrato entra como evento automático de contrato", () => {
    const timeline = buildProfileTimeline({ interactions: [], sales: [], activeCustomer: { ...contract, status: "cancelled", cancellationDate: "2026-11-01", cancellationReason: "Mudou de plano" } });
    expect(timeline).toEqual([expect.objectContaining({ kind: "contrato", label: "Contrato cancelado", content: "Mudou de plano", automatic: true })]);
  });

  it("conversa longa vira resumo sem cortar palavra; texto curto fica inteiro", () => {
    expect(summarizeContent("curto")).toBeNull();
    const long = "palavra ".repeat(60).trim();
    const summary = summarizeContent(long)!;
    expect(summary.length).toBeLessThan(long.length);
    expect(summary.endsWith("palavra…")).toBe(true);
    const [entry] = buildProfileTimeline({ interactions: [{ id: "w", tipo: "whatsapp_msg", conteudo: long, userName: null, createdAt: "2026-11-01T10:00:00Z" }], sales: [], activeCustomer: null });
    expect(entry).toMatchObject({ kind: "atendimento", summary, content: long });
  });
});

describe("resumo do perfil", () => {
  it("só afirma o que tem dado; ausência não vira em dia", () => {
    const summary = buildProfileSummary({ timeline: [], nextAction: { state: "none", taskId: null, title: null, dueAt: null, reason: "Nenhum retorno agendado para este cliente." }, sales: [], activeCustomer: null, documents: [], renewalAttention: false });
    expect(summary.lastInteraction).toBeNull();
    expect(summary.contracts).toEqual({ active: 0, total: 0, headline: null });
    expect(summary.pendencies).toEqual([]);
  });

  it("lista retorno atrasado, renovação e documentos como pendências; última interação ignora eventos automáticos", () => {
    const timeline = buildProfileTimeline({ interactions, sales: [], activeCustomer: contract });
    const summary = buildProfileSummary({
      timeline,
      nextAction: { state: "overdue", taskId: "t1", title: "Retorno", dueAt: "2026-11-01T12:00:00Z", reason: "Retorno atrasado há 3 dias." },
      sales,
      activeCustomer: contract,
      documents: [{ id: "a", filename: "rg.pdf", status: "rejected", requirementName: "RG" }, { id: "b", filename: "cpf.pdf", status: "pending", requirementName: null }],
      renewalAttention: true,
    });
    expect(summary.lastInteraction).toMatchObject({ label: "Observação", author: "Paulo Dias" });
    expect(summary.contracts).toEqual({ active: 1, total: 1, headline: "Operadora X · Essencial" });
    expect(summary.pendencies.map((item) => item.id)).toEqual(["retorno", "renovacao", "docs-recusados", "docs-pendentes"]);
  });

  it("situação e origem saem dos registros", () => {
    expect(profileSituation(null).label).toBe("Contrato não registrado");
    expect(profileSituation(contract).label).toBe("Cliente ativo");
    expect(profileSituation({ ...contract, status: "cancelled" }).label).toBe("Cliente cancelado");
    expect(profileOrigin({ origem: "webhook", sourceChannel: "meta_lead_ads" })).toBe("Meta Ads");
    expect(profileOrigin({ origem: "manual", sourceChannel: null })).toBe("Cadastro manual");
    expect(profileOrigin(null)).toBeNull();
  });
});

describe("escopo e chave do perfil", () => {
  it("só o corretor do Lite com a chave ligada vê o perfil novo", () => {
    expect(shouldUseBrokerClientProfile({ role: "broker", liteAudience: "broker", navReorgOn: true })).toBe(true);
    expect(shouldUseBrokerClientProfile({ role: "broker", liteAudience: "broker", navReorgOn: false })).toBe(false);
    expect(shouldUseBrokerClientProfile({ role: "supervisor", liteAudience: "supervisor", navReorgOn: true })).toBe(false);
    expect(shouldUseBrokerClientProfile({ role: "manager", liteAudience: "manager", navReorgOn: true })).toBe(false);
    expect(shouldUseBrokerClientProfile({ role: "broker", liteAudience: null, navReorgOn: true })).toBe(false);
  });

  it("ações só enquanto o lead do cliente é do corretor da sessão", () => {
    expect(brokerProfileCanAct({ userId: "u1", leadOwnerId: "u1" })).toBe(true);
    expect(brokerProfileCanAct({ userId: "u1", leadOwnerId: "u2" })).toBe(false);
    expect(brokerProfileCanAct({ userId: "u1", leadOwnerId: null })).toBe(false);
  });

  it("aba e filtro da URL caem no padrão quando inválidos", () => {
    expect(parseProfileTab(undefined)).toBe("historico");
    expect(parseProfileTab("contratos")).toBe("contratos");
    expect(parseProfileTab(["sobre"])).toBe("sobre");
    expect(parseProfileTab("x")).toBe("historico");
    expect(parseTimelineFilter("observacoes")).toBe("observacoes");
    expect(parseTimelineFilter("tenant")).toBe("tudo");
  });
});
