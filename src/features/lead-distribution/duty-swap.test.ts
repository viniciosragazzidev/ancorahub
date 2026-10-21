import { describe, expect, it } from "vitest";

import {
  buildDutySwapWhatsAppMessage,
  dutySwapProblem,
  effectiveSwapDate,
  longDutyDate,
  rowCoversDate,
  selectSwapCandidates,
  singleWeeklyOccurrenceDate,
  swapCandidateMatches,
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

// 2026-10-30 is a Friday (5); 2026-10-26 a Monday (1). São Paulo is UTC-3 (no DST in 2026).
const spMidnight = (date: string) => new Date(`${date}T03:00:00Z`);

describe("singleWeeklyOccurrenceDate", () => {
  it("a one-day plantão (valid 30/10 to 31/10) has one date", () => {
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 5, validFrom: spMidnight("2026-10-30"), validUntil: spMidnight("2026-10-31") }, "08:00")).toBe("2026-10-30");
  });

  it("open-ended and multi-week plantões repeat (null)", () => {
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 5, validFrom: spMidnight("2026-10-30"), validUntil: null }, "08:00")).toBeNull();
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 5, validFrom: spMidnight("2026-10-30"), validUntil: spMidnight("2026-11-07") }, "08:00")).toBeNull();
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 5, validFrom: spMidnight("2026-10-01"), validUntil: spMidnight("2026-12-01") }, "08:00")).toBeNull();
  });

  it("a one-week window holds each weekday once", () => {
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 1, validFrom: spMidnight("2026-10-30"), validUntil: spMidnight("2026-11-06") }, "08:00")).toBe("2026-11-02");
  });

  it("a window with no day of that weekday has no date", () => {
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 1, validFrom: spMidnight("2026-10-30"), validUntil: spMidnight("2026-10-31") }, "08:00")).toBeNull();
  });

  it("counts dates in São Paulo, not UTC", () => {
    // Night shift 22:00 of Fri 30/10 in SP is 01:00Z of the 31st: the date is still the 30th.
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 5, validFrom: spMidnight("2026-10-30"), validUntil: spMidnight("2026-10-31") }, "22:00")).toBe("2026-10-30");
    // Window stored at UTC midnight (29/10 21:00 to 30/10 21:00 in SP): a 22:00 shift on the 30th falls out.
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 5, validFrom: new Date("2026-10-30T00:00:00Z"), validUntil: new Date("2026-10-31T00:00:00Z") }, "22:00")).toBeNull();
    expect(singleWeeklyOccurrenceDate({ dayOfWeek: 5, validFrom: new Date("2026-10-30T00:00:00Z"), validUntil: new Date("2026-10-31T00:00:00Z") }, "08:00")).toBe("2026-10-30");
  });

  it("effectiveSwapDate keeps the published date and resolves one-time weekly rows", () => {
    const weekly = { dayOfWeek: 5, validFrom: spMidnight("2026-10-30"), validUntil: spMidnight("2026-10-31") };
    expect(effectiveSwapDate({ dutyDate: "2026-10-24", startsAt: "08:00", timezone: "America/Sao_Paulo", weekly: null })).toBe("2026-10-24");
    expect(effectiveSwapDate({ dutyDate: null, startsAt: "08:00", timezone: "America/Sao_Paulo", weekly })).toBe("2026-10-30");
    expect(effectiveSwapDate({ dutyDate: null, startsAt: "08:00", timezone: "America/Sao_Paulo", weekly: { ...weekly, validUntil: null } })).toBeNull();
  });
});

describe("one-time weekly rows in the swap", () => {
  const oneDay = { dayOfWeek: 5, validFrom: spMidnight("2026-10-30"), validUntil: spMidnight("2026-10-31") };
  const weeklyOpen = { dayOfWeek: 5, validFrom: spMidnight("2026-01-01"), validUntil: null };
  const row = (overrides: Partial<SwapCandidateRow>): SwapCandidateRow => ({ ...slot(), brokerName: "Ana Souza", brokerBranchId: "centro", ...overrides });
  // Vanessa has a published row on Mon 26/10; Rosane is on the one-day plantão of 30/10 by a weekly row.
  const vanessa = row({ id: "v", brokerId: "vanessa", brokerName: "Vanessa", scheduleId: "pme", scheduleName: "PME Manhã", dutyDate: "2026-10-26" });
  const rosane = row({ id: "r", brokerId: "rosane", brokerName: "Rosane Santana", brokerCode: "RS12", scheduleId: "pres", scheduleName: "PRESENCIAL MANHÃ", dutyDate: "2026-10-30", weekly: oneDay });
  const director = { role: "director", branchId: null };

  it("a one-time weekly row is a candidate, and can be the source", () => {
    expect(selectSwapCandidates(vanessa, [vanessa, rosane], director, NOW).map((item) => item.brokerName)).toEqual(["Rosane Santana"]);
    expect(selectSwapCandidates(rosane, [vanessa, rosane], director, NOW).map((item) => item.brokerName)).toEqual(["Vanessa"]);
  });

  it("a repeating weekly row is never a candidate", () => {
    const repeating = row({ id: "w", brokerId: "walter", brokerName: "Walter", scheduleId: "pf", dutyDate: null, weekly: weeklyOpen });
    expect(selectSwapCandidates(vanessa, [vanessa, repeating], director, NOW)).toEqual([]);
  });

  it("no duplicates: weekly rows count as being on the plantão that day", () => {
    // Vanessa is already on the one-day plantão through another weekly row.
    const vanessaWeekly = row({ id: "v2", brokerId: "vanessa", scheduleId: "pres", dutyDate: "2026-10-30", weekly: oneDay });
    expect(selectSwapCandidates(vanessa, [vanessa, rosane, vanessaWeekly], director, NOW)).toEqual([]);
    // Rosane is on Vanessa's plantão every Monday (repeating weekly row).
    const rosaneMondays = row({ id: "r2", brokerId: "rosane", scheduleId: "pme", dutyDate: null, weekly: { ...weeklyOpen, dayOfWeek: 1 } });
    expect(selectSwapCandidates(vanessa, [vanessa, rosane, rosaneMondays], director, NOW)).toEqual([]);
  });

  it("rowCoversDate: dated row, one-time weekly and repeating weekly", () => {
    expect(rowCoversDate(rosane, "pres", "2026-10-30")).toBe(true);
    expect(rowCoversDate(rosane, "pres", "2026-11-06")).toBe(false);
    expect(rowCoversDate(row({ scheduleId: "pf", dutyDate: null, weekly: weeklyOpen }), "pf", "2026-11-06")).toBe(true);
    expect(rowCoversDate(row({ scheduleId: "pf", dutyDate: null, weekly: weeklyOpen }), "pf", "2026-11-05")).toBe(false);
  });

  it("the swap accepts a one-time weekly row and refuses a repeating one", () => {
    expect(dutySwapProblem(input({ target: rosane, targetBroker: broker({ id: "rosane", name: "Rosane Santana" }) }))).toBeNull();
    expect(dutySwapProblem(input({ target: row({ id: "w", brokerId: "bruno", scheduleId: "pf", dutyDate: null, weekly: weeklyOpen }) }))).toMatch(/se repete/);
  });

  it("the search matches part of the name or the code", () => {
    const [candidate] = selectSwapCandidates(vanessa, [vanessa, rosane], director, NOW);
    expect(swapCandidateMatches(candidate, "Rosane")).toBe(true);
    expect(swapCandidateMatches(candidate, "ros")).toBe(true);
    expect(swapCandidateMatches(candidate, "rosane santana")).toBe(true);
    expect(swapCandidateMatches(candidate, "rs12")).toBe(true);
    expect(swapCandidateMatches(candidate, "presencial 30/10")).toBe(true);
    expect(swapCandidateMatches(candidate, "manha")).toBe(true);
    expect(swapCandidateMatches(candidate, "bruno")).toBe(false);
  });
});
