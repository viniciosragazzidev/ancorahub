import { describe, expect, it } from "vitest";

import {
  buildDutySwapWhatsAppMessage,
  dutySwapProblem,
  longDutyDate,
  selectSwapCandidates,
  swapNoticeFor,
  swapNoticeText,
  swapPlanAssignments,
  type SwapBroker,
  type SwapCandidateRow,
  type SwapProblemInput,
  type SwapRecord,
  type SwapSlot,
} from "./duty-swap";

// 2026-10-21 12:00 in São Paulo (UTC-3).
const NOW = new Date("2026-10-21T15:00:00Z");

const slot = (overrides: Partial<SwapSlot> = {}): SwapSlot => ({
  id: "a",
  status: "active",
  scheduleId: "s1",
  scheduleName: "PME Manhã",
  scheduleStatus: "active",
  scheduleBranchId: null,
  brokerId: "ana",
  dutyDate: "2026-10-24",
  startsAt: "08:00",
  endsAt: "12:00",
  timezone: "America/Sao_Paulo",
  ...overrides,
});
const broker = (overrides: Partial<SwapBroker> = {}): SwapBroker => ({ id: "ana", name: "Ana Souza", branchId: "centro", eligible: true, ...overrides });

const input = (overrides: Partial<SwapProblemInput> = {}): SwapProblemInput => ({
  actor: { role: "director", branchId: null },
  source: slot(),
  target: slot({ id: "b", scheduleId: "s2", scheduleName: "PF Tarde", brokerId: "bruno", dutyDate: "2026-10-25", startsAt: "13:00", endsAt: "18:00" }),
  sourceBroker: broker(),
  targetBroker: broker({ id: "bruno", name: "Bruno Lima" }),
  sourceBrokerAlreadyOnTarget: false,
  targetBrokerAlreadyOnSource: false,
  now: NOW,
  ...overrides,
});

describe("dutySwapProblem", () => {
  it("accepts two future published slots of different brokers", () => {
    expect(dutySwapProblem(input())).toBeNull();
  });

  it("only Diretor and Gestor swap", () => {
    expect(dutySwapProblem(input({ actor: { role: "supervisor", branchId: "centro" } }))).toMatch(/Apenas Diretores e Gestores/);
    expect(dutySwapProblem(input({ actor: { role: "broker", branchId: "centro" } }))).toMatch(/Apenas Diretores e Gestores/);
  });

  it("refuses a slot that no longer exists or left the roster", () => {
    expect(dutySwapProblem(input({ target: null }))).toMatch(/não existe mais/);
    expect(dutySwapProblem(input({ source: slot({ status: "inactive" }) }))).toMatch(/não existe mais/);
  });

  it("refuses the same slot and weekly rows", () => {
    expect(dutySwapProblem(input({ target: slot() }))).toMatch(/Escolha outra/);
    expect(dutySwapProblem(input({ source: slot({ dutyDate: null }) }))).toMatch(/escala publicada/);
  });

  it("refuses a plantão that already started or ended", () => {
    expect(dutySwapProblem(input({ source: slot({ dutyDate: "2026-10-21", startsAt: "11:00" }) }))).toMatch(/já começou/);
    expect(dutySwapProblem(input({ source: slot({ dutyDate: "2026-10-20" }) }))).toMatch(/já começou/);
    // Later today is still swappable.
    expect(dutySwapProblem(input({ source: slot({ dutyDate: "2026-10-21", startsAt: "13:00" }) }))).toBeNull();
  });

  it("refuses an inactive plantão", () => {
    expect(dutySwapProblem(input({ target: slot({ id: "b", brokerId: "bruno", scheduleStatus: "inactive", scheduleName: "PF Tarde" }) }))).toMatch(/PF Tarde não está mais ativo/);
  });

  it("refuses the same broker and the same plantão and day", () => {
    expect(dutySwapProblem(input({ target: slot({ id: "b", scheduleId: "s2", dutyDate: "2026-10-25" }) }))).toMatch(/mesmo corretor/);
    expect(dutySwapProblem(input({ target: slot({ id: "b", brokerId: "bruno" }) }))).toMatch(/mesmo plantão/);
  });

  it("refuses a broker out of the escala", () => {
    expect(dutySwapProblem(input({ targetBroker: broker({ id: "bruno", name: "Bruno Lima", eligible: false }) }))).toMatch(/Bruno Lima está fora da escala/);
  });

  it("keeps the Gestor inside his unit", () => {
    const manager = { role: "manager", branchId: "centro" };
    expect(dutySwapProblem(input({ actor: manager }))).toBeNull();
    expect(dutySwapProblem(input({ actor: manager, targetBroker: broker({ id: "bruno", name: "Bruno Lima", branchId: "norte" }) }))).toMatch(/sua unidade/);
    expect(dutySwapProblem(input({ actor: manager, source: slot({ scheduleBranchId: "norte" }) }))).toMatch(/sua unidade/);
  });

  it("a unit plantão only takes brokers of that unit", () => {
    const target = slot({ id: "b", scheduleId: "s2", scheduleName: "PF Norte", brokerId: "bruno", dutyDate: "2026-10-25", scheduleBranchId: "norte" });
    expect(dutySwapProblem(input({ target, targetBroker: broker({ id: "bruno", name: "Bruno Lima", branchId: "norte" }) }))).toMatch(/A unidade de Ana Souza não é a do plantão PF Norte/);
  });

  it("never leaves a broker twice on one plantão and day", () => {
    expect(dutySwapProblem(input({ sourceBrokerAlreadyOnTarget: true }))).toBe("Ana Souza já está no plantão PF Tarde em 25/10.");
    expect(dutySwapProblem(input({ targetBrokerAlreadyOnSource: true }))).toBe("Bruno Lima já está no plantão PME Manhã em 24/10.");
  });
});

describe("selectSwapCandidates", () => {
  const row = (overrides: Partial<SwapCandidateRow>): SwapCandidateRow => ({ ...slot(), brokerName: "Ana Souza", brokerBranchId: "centro", ...overrides });
  const source = row({});
  const rows = [
    source,
    row({ id: "b", brokerId: "bruno", brokerName: "Bruno Lima", scheduleId: "s2", scheduleName: "PF Tarde", dutyDate: "2026-10-25" }),
    row({ id: "c", brokerId: "carla", brokerName: "Carla Dias", dutyDate: "2026-10-24" }), // same plantão and day
    row({ id: "d", brokerId: "ana", scheduleId: "s3", dutyDate: "2026-10-26" }), // same broker
    row({ id: "e", brokerId: "duda", brokerName: "Duda", scheduleId: "s2", dutyDate: "2026-10-20" }), // past
    row({ id: "f", brokerId: "edu", brokerName: "Edu", scheduleId: "s4", dutyDate: "2026-10-27" }), // Ana is already on s4 that day
    row({ id: "g", brokerId: "ana", scheduleId: "s4", dutyDate: "2026-10-27" }),
    row({ id: "h", brokerId: "fabi", brokerName: "Fabi", scheduleId: "s5", dutyDate: "2026-10-23", startsAt: "09:00" }),
    row({ id: "i", brokerId: "gil", brokerName: "Gil", scheduleId: "s6", dutyDate: "2026-10-28", scheduleBranchId: "norte", brokerBranchId: "norte" }), // unit plantão of another unit
  ];

  it("lists future slots of other brokers, sorted by date", () => {
    expect(selectSwapCandidates(source, rows, { role: "director", branchId: null }, NOW).map((item) => item.assignmentId)).toEqual(["h", "b"]);
  });

  it("the Gestor only sees his unit", () => {
    const mixed = [...rows, row({ id: "j", brokerId: "hugo", brokerName: "Hugo", scheduleId: "s7", dutyDate: "2026-10-29", brokerBranchId: "norte" })];
    expect(selectSwapCandidates(source, mixed, { role: "manager", branchId: "centro" }, NOW).map((item) => item.assignmentId)).toEqual(["h", "b"]);
  });
});

describe("swapPlanAssignments", () => {
  const moves = [
    { occurrenceId: "s1:2026-10-24", fromBrokerId: "ana", toBrokerId: "bruno" },
    { occurrenceId: "s2:2026-10-25", fromBrokerId: "bruno", toBrokerId: "ana" },
  ];

  it("swaps the brokers of both entries and keeps the rest", () => {
    const plan = {
      assignments: [
        { occurrenceId: "s1:2026-10-24", brokerId: "ana", origin: "generated", rosterAssignmentId: "a" },
        { occurrenceId: "s2:2026-10-25", brokerId: "bruno", origin: "manual", rosterAssignmentId: "b" },
        { occurrenceId: "s1:2026-10-24", brokerId: "carla", origin: "generated" },
      ],
      occurrences: [
        { id: "s1:2026-10-24", allowedBrokerIds: ["ana", "bruno", "carla"] },
        { id: "s2:2026-10-25", allowedBrokerIds: ["bruno"] },
      ],
    };
    const result = swapPlanAssignments(plan, moves);
    expect(result.changed).toBe(true);
    expect(result.assignments).toEqual([
      { occurrenceId: "s1:2026-10-24", brokerId: "bruno", origin: "generated", rosterAssignmentId: "a" },
      { occurrenceId: "s2:2026-10-25", brokerId: "ana", origin: "manual", rosterAssignmentId: "b" },
      { occurrenceId: "s1:2026-10-24", brokerId: "carla", origin: "generated" },
    ]);
    // Ana was not allowed in s2: she stays allowed there (as a confirmed exception).
    expect(result.occurrences[1]).toEqual({ id: "s2:2026-10-25", allowedBrokerIds: ["bruno", "ana"], forcedBrokerIds: ["ana"] });
    expect(result.occurrences[0]).toBe(plan.occurrences[0]);
  });

  it("does nothing on a plan without these entries", () => {
    const plan = { assignments: [{ occurrenceId: "s9:2026-10-24", brokerId: "ana" }], occurrences: [] };
    expect(swapPlanAssignments(plan, moves).changed).toBe(false);
    expect(swapPlanAssignments({ assignments: null, occurrences: null }, moves).changed).toBe(false);
  });
});

describe("swap notice", () => {
  const record: SwapRecord = {
    id: "swap",
    assignmentAId: "a",
    assignmentBId: "b",
    brokerAId: "ana",
    brokerBId: "bruno",
    brokerAName: "Ana Souza",
    brokerBName: "Bruno Lima",
    scheduleAName: "PME Manhã",
    scheduleBName: "PF Tarde",
    dutyDateA: "2026-10-24",
    dutyDateB: "2026-10-25",
    whatsappAStatus: "sent",
    whatsappBStatus: "no_phone",
    swappedAt: NOW,
  };

  it("each slot shows who it was swapped with and where its broker was before", () => {
    // Slot A now has Bruno, who was on B (25/10).
    const onA = swapNoticeFor(record, "a", "bruno");
    expect(onA && swapNoticeText(onA)).toBe("Troca feita com Ana Souza (antes em 25/10, PF Tarde).");
    expect(onA?.whatsappStatus).toBe("no_phone");
    const onB = swapNoticeFor(record, "b", "ana");
    expect(onB && swapNoticeText(onB)).toBe("Troca feita com Bruno Lima (antes em 24/10, PME Manhã).");
    expect(onB?.whatsappStatus).toBe("sent");
  });

  it("disappears when the slot changed broker again", () => {
    expect(swapNoticeFor(record, "a", "carla")).toBeNull();
    expect(swapNoticeFor(record, "z", "bruno")).toBeNull();
  });
});

describe("buildDutySwapWhatsAppMessage", () => {
  const message = buildDutySwapWhatsAppMessage({
    brokerName: "Ana Souza",
    partnerName: "Bruno Lima",
    tenantName: "Âncora Saúde",
    newSlot: { scheduleName: "PF Tarde", dutyDate: "2026-10-25", startsAt: "13:00:00", endsAt: "18:00" },
    previousSlot: { scheduleName: "PME Manhã", dutyDate: "2026-10-24" },
  });

  it("tells the new date, plantão and time and where the broker was", () => {
    expect(message).toBe([
      "Olá, Ana! A gestão da Âncora Saúde fez uma troca na sua escala de plantão: você trocou com Bruno Lima.",
      "",
      "Seu novo plantão: PF Tarde, domingo, 25/10, das 13:00 às 18:00.",
      "Antes você estava no plantão PME Manhã, sábado, 24/10, que agora é de Bruno Lima.",
      "",
      "Se tiver alguma dúvida, fale com a sua gestão.",
    ].join("\n"));
  });

  it("never uses the long dash", () => {
    expect(message).not.toContain("—");
    expect(buildDutySwapWhatsAppMessage({ brokerName: null, partnerName: "X", tenantName: null, newSlot: { scheduleName: "P", dutyDate: "2026-10-25", startsAt: "08:00", endsAt: "09:00" }, previousSlot: { scheduleName: "Q", dutyDate: "2026-10-24" } })).toMatch(/^Olá! A gestão da Âncora Saúde/);
  });

  it("formats the weekday in pt-BR", () => {
    expect(longDutyDate("2026-10-24")).toBe("sábado, 24/10");
  });
});
