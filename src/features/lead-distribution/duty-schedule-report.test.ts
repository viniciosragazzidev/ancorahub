import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));

import { buildDutyScheduleReport } from "./duty-schedule-report";
import { encodeDutySchedulePdf, type DutyScheduleReportLead } from "./duty-schedule-pdf";

type Profile = Parameters<typeof buildDutyScheduleReport>[0];

const since = new Date("2026-09-24T11:00:00.000Z"); // 08:00 in São Paulo
const lead = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  nome: `Lead ${id}`,
  telefone: "+5521999990000",
  status: "distributed",
  distributionStatus: "assigned",
  corretorId: "broker-1",
  brokerName: "Ana Lima",
  queueId: "queue-1",
  queueName: "Plantão PME",
  assignedAt: new Date("2026-09-24T12:00:00.000Z"),
  createdAt: new Date("2026-09-24T11:30:00.000Z"),
  ...overrides,
});

const rosterEntry = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  brokerId: `broker-${id}`,
  brokerName: `Corretor ${id}`,
  internalCode: `C${id}`,
  availabilityStatus: "available",
  pausedAt: null,
  presenceStatus: "confirmed",
  confirmedAt: new Date("2026-09-24T10:50:00.000Z"),
  blockedReason: null,
  liveStatus: "ready",
  nextEventAt: null,
  leadsInWindow: 2,
  activeLeads: 3,
  capacity: 5,
  ...overrides,
});

function profile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schedule: { id: "s1", name: "Plantão PME", branchName: "Matriz 7º Andar", queueName: "Fila PME", dayOfWeek: 4, startsAt: "08:00:00", endsAt: "18:00:00", timezone: "America/Sao_Paulo", minimumBrokers: 3, status: "active" },
    roster: [rosterEntry("1"), rosterEntry("2", { presenceStatus: "pending", confirmedAt: null, blockedReason: "Aguardando confirmação do plantão" })],
    linkedQueues: [{ id: "queue-1", name: "Plantão PME" }],
    leads: [
      lead("m1"),
      lead("t1", { assignedAt: new Date("2026-09-24T17:00:00.000Z") }), // 14:00 local
      lead("w1", { corretorId: null, brokerName: null, assignedAt: null, distributionStatus: "queued", status: "new", createdAt: new Date("2026-09-24T16:30:00.000Z") }),
    ],
    leadsSince: since,
    leadsUntil: null,
    presenceEnabled: true,
    liveStatusEnabled: true,
    ...overrides,
  } as unknown as Profile;
}

describe("buildDutyScheduleReport", () => {
  it("summarizes the same counts the plantão page shows", () => {
    const report = buildDutyScheduleReport(profile(), new Set(["w1"]), 200);

    expect(report.summary).toEqual([
      { label: "Leads recebidos", value: "3" },
      { label: "Distribuídos", value: "2" },
      { label: "Aguardando distribuição", value: "1" },
      { label: "Devolvidos sem aceite", value: "1" },
      { label: "Cobertura da escala", value: "2/3" },
      { label: "Presença confirmada", value: "1/2" },
    ]);
    expect(report.scheduleDetails).toBe("Matriz 7º Andar · Plantão PME · Quinta 08:00 às 18:00 (America/Sao_Paulo)");
    expect(report.leadsTruncatedAt).toBeNull();
  });

  it("lists brokers with presence and flags blocked ones", () => {
    const [ready, blocked] = buildDutyScheduleReport(profile(), new Set(), 200).brokers;
    expect(ready).toMatchObject({ code: "C1", presence: "Confirmada às 07:50", situation: "Pronto para receber", situationAlert: false, capacity: 5 });
    expect(blocked).toMatchObject({ presence: "Pendente", situation: "Aguardando confirmação do plantão", situationAlert: true });
  });

  it("splits leads into the page's morning/afternoon blocks with readable labels", () => {
    const report = buildDutyScheduleReport(profile(), new Set(["w1"]), 200);
    expect(report.leadGroups.map((group) => [group.label, group.leads.map((item) => item.name)])).toEqual([
      ["Manhã · até 12:59", ["Lead m1"]],
      ["Tarde · a partir de 13:00", ["Lead t1", "Lead w1"]],
    ]);
    const waiting = report.leadGroups[1].leads[1];
    expect(waiting).toMatchObject({ broker: "Sem corretor", returnedUnaccepted: true, distribution: "Aguardando corretor", stage: "Novo", assignedAt: null });
  });

  it("marks the list as partial when it reached the query cap", () => {
    expect(buildDutyScheduleReport(profile(), new Set(), 3).leadsTruncatedAt).toBe(3);
  });
});

describe("encodeDutySchedulePdf", () => {
  it("renders a valid multi-page PDF, even with characters outside WinAnsi", async () => {
    const manyLeads: DutyScheduleReportLead[] = Array.from({ length: 60 }, (_, index) => ({
      name: `Lead ${index} 🚀 – teste`,
      phone: "+5521999990000",
      queue: "Plantão PME",
      broker: "Ana Lima",
      returnedUnaccepted: index % 7 === 0,
      distribution: "Atribuído",
      stage: "Distribuído",
      receivedAt: new Date("2026-09-24T12:00:00.000Z"),
      assignedAt: index % 2 ? new Date("2026-09-24T12:05:00.000Z") : null,
    }));
    const bytes = await encodeDutySchedulePdf({
      ...buildDutyScheduleReport(profile(), new Set(), 200),
      leadGroups: [{ label: "Manhã · até 12:59", leads: manyLeads }],
      tenantName: "Honorio ◤✠◢ Cavalcante",
      generatedAt: new Date("2026-09-24T18:00:00.000Z"),
    });

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("still renders when the plantão has no brokers and no leads", async () => {
    const bytes = await encodeDutySchedulePdf({
      ...buildDutyScheduleReport(profile({ roster: [], leads: [] }), new Set(), 200),
      tenantName: "AncoraHub",
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
