import { describe, expect, it } from "vitest";

import { classifyFirstContact, groupSupervisorPendencies, isOfferActionable, isReturnTaskOverdue, isShiftActiveNow } from "./control-core";
import { prioritizeBrokerWorkspace, type BrokerWorkspacePriorityLead } from "@/features/broker-workspace/priority";

const now = new Date("2026-11-25T15:00:00.000Z");
const lead = {
  leadId: "lead-1", name: "Lead de exemplo", brokerId: "broker-1", brokerName: "Corretora Exemplo",
  status: "in_contact", sourceChannel: "supervisor_import", sourceMetadata: {}, assignedAt: new Date(now.getTime() - 23 * 3_600_000),
  firstContactAt: null, stageEnteredAt: null, latestMessageAt: null, slaMinutes: 15, now,
};

describe("regras de motivo no controle do supervisor", () => {
  it("não transforma lista importada em ruído antes do prazo confirmado de 24 h", () => {
    expect(classifyFirstContact(lead)).toBeNull();
  });

  it("só mostra a lista importada depois das 24 h sem primeiro contato", () => {
    const pending = classifyFirstContact({ ...lead, assignedAt: new Date(now.getTime() - 24 * 3_600_000) });
    expect(pending).toMatchObject({ reason: "first_contact_overdue", detail: expect.stringContaining("24 h da lista importada") });
    expect(pending?.detail).toContain("0 min vencido");
  });

  it("tira da pendência quem já foi contatado ou já avançou de etapa", () => {
    expect(classifyFirstContact({ ...lead, assignedAt: new Date(now.getTime() - 30 * 3_600_000), firstContactAt: new Date(now.getTime() - 1_000) })).toBeNull();
    expect(classifyFirstContact({ ...lead, assignedAt: new Date(now.getTime() - 30 * 3_600_000), latestMessageAt: new Date(now.getTime() - 1_000) })).toBeNull();
    expect(classifyFirstContact({ ...lead, status: "contacted", assignedAt: new Date(now.getTime() - 30 * 3_600_000), stageEnteredAt: new Date(now.getTime() - 1_000) })).toBeNull();
    expect(classifyFirstContact({ ...lead, sourceChannel: "whatsapp", status: "distributed", assignedAt: new Date(now.getTime() - 30 * 60_000), latestMessageAt: new Date(now.getTime() - 1_000) })).toMatchObject({ reason: "first_contact_overdue" });
  });

  it("mantém o SLA da empresa nos leads quentes e agrupa pendências por motivo", () => {
    const hotLead = classifyFirstContact({ ...lead, sourceChannel: "whatsapp", status: "distributed", assignedAt: new Date(now.getTime() - 20 * 60_000), slaMinutes: 15 });
    const groups = groupSupervisorPendencies([
      { id: "return", reason: "return_overdue", leadId: "l2", leadName: "B", brokerId: "b", brokerName: "B", dueAt: "2026-11-25T14:00:00Z", detail: "Retorno vencido" },
      hotLead!,
    ]);
    expect(hotLead?.detail).toContain("SLA");
    expect(groups.map((group) => [group.reason, group.count])).toEqual([["first_contact_overdue", 1], ["return_overdue", 1]]);
  });

  it("reconhece plantões que atravessam a meia-noite e ignora turno pausado", () => {
    expect(isShiftActiveNow("22:00", "02:00", "00:30", false)).toBe(true);
    expect(isShiftActiveNow("09:00", "12:00", "09:00", true)).toBe(false);
  });
});

describe("paridade do SLA entre corretor e supervisor", () => {
  it("usa o mesmo SLA do corretor para etapas quentes, mensagens e lista importada", () => {
    const cases: Array<{ name: string; overrides: Partial<typeof lead>; hasAnyMessage: boolean; overdue: boolean }> = [
      { name: "lead quente em etapa ativa", overrides: { sourceChannel: "whatsapp", status: "negotiation", assignedAt: new Date(now.getTime() - 30 * 60_000) }, hasAnyMessage: false, overdue: true },
      { name: "mensagem nao grava primeiro contato do lead quente", overrides: { sourceChannel: "whatsapp", status: "quote_sent", assignedAt: new Date(now.getTime() - 30 * 60_000) }, hasAnyMessage: true, overdue: true },
      { name: "mensagem da lista conta mesmo se falhou ou foi removida", overrides: { status: "in_contact", assignedAt: new Date(now.getTime() - 25 * 3_600_000) }, hasAnyMessage: true, overdue: false },
      { name: "lista em novo sem stageEnteredAt vence em 24 horas", overrides: { status: "distributed", assignedAt: new Date(now.getTime() - 25 * 3_600_000), stageEnteredAt: null }, hasAnyMessage: false, overdue: true },
    ];

    for (const scenario of cases) {
      const input = { ...lead, ...scenario.overrides, hasAnyMessage: scenario.hasAnyMessage };
      const supervisorOverdue = Boolean(classifyFirstContact(input));
      const brokerLead: BrokerWorkspacePriorityLead = {
        id: input.leadId,
        name: input.name,
        status: input.status,
        createdAt: input.assignedAt ?? now,
        assignedAt: input.assignedAt,
        firstContactAt: input.firstContactAt,
        stageEnteredAt: input.stageEnteredAt,
        sourceChannel: input.sourceChannel,
        hasAnyMessage: scenario.hasAnyMessage,
        importedFirstContactHours: input.sourceChannel === "supervisor_import" ? 24 : null,
        lastIncomingAt: null,
        hasPendingQuote: false,
        pendingDocumentCount: 0,
      };
      const brokerOverdue = prioritizeBrokerWorkspace({ leads: [brokerLead], tasks: [], now, slaFirstContactMinutes: input.slaMinutes })
        .some((item) => item.kind === "sla_overdue");

      expect(supervisorOverdue).toBe(scenario.overdue);
      expect(brokerOverdue).toBe(scenario.overdue);
    }
  });
});

describe("regras de ofertas e retornos no controle", () => {
  it("only shows open offers after five minutes while the lead stays assigned", () => {
    const offer = { status: "READ", offeredAt: new Date(now.getTime() - 6 * 60_000), expiresAt: new Date(now.getTime() + 60_000), leadStatus: "distributed", currentOwnerId: "broker-1", brokerId: "broker-1", now };
    expect(isOfferActionable(offer)).toBe(true);
    expect(isOfferActionable({ ...offer, offeredAt: new Date(now.getTime() - 4 * 60_000) })).toBe(false);
    expect(isOfferActionable({ ...offer, expiresAt: new Date(now.getTime() - 1) })).toBe(false);
    expect(isOfferActionable({ ...offer, currentOwnerId: "broker-2" })).toBe(false);
  });

  it("no future or completed return is actionable", () => {
    expect(isReturnTaskOverdue({ title: "Retorno para cliente", dueAt: new Date(now.getTime() + 60_000), completedAt: null, now })).toBe(false);
    expect(isReturnTaskOverdue({ title: "Retorno para cliente", dueAt: new Date(now.getTime() - 60_000), completedAt: now, now })).toBe(false);
    expect(isReturnTaskOverdue({ title: "Retorno para cliente", dueAt: new Date(now.getTime() - 60_000), completedAt: null, now })).toBe(true);
    expect(isReturnTaskOverdue({ title: "Conferir proposta", dueAt: new Date(now.getTime() - 60_000), completedAt: null, now })).toBe(false);
  });
});
