import { describe, expect, it } from "vitest";

import { prioritizeBrokerWorkspace, type BrokerWorkspacePriorityLead } from "./priority";
import { nextStepFor } from "./chat/lead-arrival";
import {
  IMPORTED_FIRST_CONTACT_HOURS,
  cleanFirstContactHours,
  groupExpiredImportBatches,
  importedFirstContactHours,
  isImportedLeadPending,
} from "./imported-first-contact";

const assignedAt = new Date("2026-11-24T12:00:00.000Z");
const hour = 3_600_000;

function lead(overrides: Partial<BrokerWorkspacePriorityLead> = {}): BrokerWorkspacePriorityLead {
  return {
    id: "lead-lista",
    name: "Pessoa sintética",
    status: "in_contact",
    createdAt: new Date("2026-11-20T12:00:00.000Z"),
    assignedAt,
    firstContactAt: null,
    stageEnteredAt: assignedAt,
    lastIncomingAt: null,
    hasPendingQuote: false,
    pendingDocumentCount: 0,
    ...overrides,
  };
}

const run = (item: BrokerWorkspacePriorityLead, now: Date) => prioritizeBrokerWorkspace({ now, slaFirstContactMinutes: 15, leads: [item], tasks: [] });
const firstContactKinds = (item: BrokerWorkspacePriorityLead, now: Date) => run(item, now).filter((priority) => priority.kind === "sla_overdue" || priority.kind === "sla_risk").map((priority) => priority.kind);

describe("pendência do lead da lista da equipe", () => {
  it("dentro do prazo não é pendência, nem logo depois de chegar", () => {
    const imported = lead({ importedFirstContactHours: 24 });
    expect(firstContactKinds(imported, new Date(assignedAt.getTime() + 60_000))).toEqual([]);
    expect(firstContactKinds(imported, new Date(assignedAt.getTime() + 23 * hour))).toEqual([]);
  });

  it("depois do prazo sem contato vira pendência", () => {
    const result = run(lead({ importedFirstContactHours: 24 }), new Date(assignedAt.getTime() + 24 * hour + 60_000));
    expect(result[0]).toMatchObject({ kind: "sla_overdue", severity: "critical", dueAt: new Date(assignedAt.getTime() + 24 * hour) });
  });

  it("respeita o prazo escolhido na importação", () => {
    const imported = lead({ importedFirstContactHours: 4 });
    expect(firstContactKinds(imported, new Date(assignedAt.getTime() + 3 * hour))).toEqual([]);
    expect(firstContactKinds(imported, new Date(assignedAt.getTime() + 5 * hour))).toEqual(["sla_overdue"]);
  });

  it("com contato feito não é pendência, mesmo depois do prazo", () => {
    const contacted = lead({ importedFirstContactHours: 24, firstContactAt: new Date(assignedAt.getTime() + 2 * hour) });
    expect(firstContactKinds(contacted, new Date(assignedAt.getTime() + 48 * hour))).toEqual([]);
  });

  it("lead quente segue o SLA da empresa, sem mudança", () => {
    const hot = lead({ status: "distributed" });
    expect(firstContactKinds(hot, new Date(assignedAt.getTime() + 6 * 60_000))).toEqual(["sla_risk"]);
    expect(firstContactKinds(hot, new Date(assignedAt.getTime() + 16 * 60_000))).toEqual(["sla_overdue"]);
  });
});

describe("regras puras do prazo", () => {
  it("lê o prazo gravado e cai em 24 h quando falta ou é inválido", () => {
    expect(importedFirstContactHours({ firstContactHours: 48 })).toBe(48);
    expect(importedFirstContactHours({ firstContactHours: "12" })).toBe(12);
    expect(importedFirstContactHours({ firstContactHours: 7 })).toBe(IMPORTED_FIRST_CONTACT_HOURS);
    expect(importedFirstContactHours(null)).toBe(IMPORTED_FIRST_CONTACT_HOURS);
    expect(cleanFirstContactHours(9999)).toBe(IMPORTED_FIRST_CONTACT_HOURS);
  });

  it("isImportedLeadPending segue a mesma regra", () => {
    expect(isImportedLeadPending({ assignedAt, contacted: false, now: new Date(assignedAt.getTime() + hour) })).toBe(false);
    expect(isImportedLeadPending({ assignedAt, contacted: false, now: new Date(assignedAt.getTime() + 25 * hour) })).toBe(true);
    expect(isImportedLeadPending({ assignedAt, contacted: true, now: new Date(assignedAt.getTime() + 25 * hour) })).toBe(false);
  });

  it("agrupa o lote vencido em um aviso por corretor e entrega (nunca um por lead)", () => {
    const now = new Date(assignedAt.getTime() + 25 * hour);
    const later = new Date(assignedAt.getTime() + 2 * hour);
    const batches = groupExpiredImportBatches([
      ...Array.from({ length: 30 }, () => ({ brokerId: "ana", assignedAt, hours: 24, contacted: false })),
      { brokerId: "ana", assignedAt, hours: 24, contacted: true },
      { brokerId: "bia", assignedAt, hours: 24, contacted: false },
      { brokerId: "ana", assignedAt: later, hours: 24, contacted: false },
    ], now);
    expect(batches).toEqual([
      { brokerId: "ana", assignedAt, count: 30 },
      { brokerId: "bia", assignedAt, count: 1 },
    ]);
  });
});

describe("próximo passo na tela do lead", () => {
  const base = { owned: true, accepted: true, closed: false, lastClientAt: null, lastBrokerAt: null, nextAction: null };

  it("dentro do prazo da lista o passo é calmo", () => {
    const step = nextStepFor({ ...base, now: new Date(assignedAt.getTime() + hour), firstContactDueAt: new Date(assignedAt.getTime() + 24 * hour) });
    expect(step).toMatchObject({ kind: "whatsapp", tone: "normal" });
  });

  it("depois do prazo, ou sem prazo (lead quente), volta a ser urgente", () => {
    expect(nextStepFor({ ...base, now: new Date(assignedAt.getTime() + 25 * hour), firstContactDueAt: new Date(assignedAt.getTime() + 24 * hour) }).tone).toBe("urgent");
    expect(nextStepFor({ ...base, now: new Date(assignedAt.getTime() + hour) }).tone).toBe("urgent");
  });
});
