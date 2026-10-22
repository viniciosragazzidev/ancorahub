import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked database: selects are answered in call order from a queue; writes are recorded.
const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  updates: [] as Array<{ table: unknown; set: Record<string, unknown> }>,
  transactions: 0,
  lockCalls: 0,
  events: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./roster-broker-account-filter", () => ({ getRosterBrokerAccountFilter: async () => undefined }));
vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ tenantId: "t1", userId: "dir-1", role: "director", branchId: null }),
}));
vi.mock("@/features/system-settings/queries", async () => ({
  FEATURE_FLAGS: (await vi.importActual<typeof import("@/shared/feature-flags/catalog")>("@/shared/feature-flags/catalog")).FEATURE_FLAGS,
  getFeatureFlag: async () => "true",
}));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  const selectChain = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      state.events.push("select");
      return Promise.resolve(state.queue.shift() ?? []).then(resolve, reject);
    };
    return chain;
  };
  const tx = {
    execute: async () => { state.lockCalls += 1; state.events.push("lock"); return []; },
    select: selectChain,
    insert: (table: unknown) => ({ values: (values: unknown) => {
      state.inserts.push({ table, values: (Array.isArray(values) ? { rows: values } : values) as Record<string, unknown> });
      return { onConflictDoNothing: async () => []  };
    } }),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({ where: () => {
        state.updates.push({ table, set });
        return {
          returning: async () => [{ id: "published-plan" }],
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve([]).then(resolve, reject),
        };
      } }),
    }),
  };
  const db = { ...tx, transaction: async (callback: (value: typeof tx) => unknown) => { state.transactions += 1; return callback(tx); } };
  return { ...actual, getDatabase: () => db };
});

import * as schema from "@/shared/db/schema";
import { addBrokerToPublishedOccurrenceAction, generateMonthlyDutyPlanAction, getMonthlyDutyPlanAction, publishMonthlyDutyPlanAction } from "./monthly-duty-actions";
import { removeRosterAssignmentAction } from "./roster-actions";

const FUTURE_DAY = "2099-10-20";
const OCCURRENCE_ID = `sch-1:${FUTURE_DAY}`;
const DATED_ASSIGNMENT_ID = "d8180a70-455a-4c9c-8a50-2363c9a81651";

const occurrence = {
  id: OCCURRENCE_ID, scheduleId: "sch-1", scheduleName: "Manhã", dutyDate: FUTURE_DAY, startsAt: "08:00", endsAt: "12:00",
  minimumBrokers: 1, maximumBrokers: 2, allowedBrokerIds: ["bruno"], typeId: "t1", attendanceMode: "any", brokers: [], assignedCount: 0, ended: false,
};

const publishedPlan = {
  id: "plan-9", tenantId: "t1", monthKey: "2099-10", revision: 9, status: "published", occurrences: [occurrence], assignments: [],
  quotas: [], settings: null,
};

const draftPlan = {
  id: "plan-10", tenantId: "t1", monthKey: "2099-10", revision: 10, status: "draft", occurrences: [occurrence],
  assignments: [{ occurrenceId: OCCURRENCE_ID, brokerId: "carla", origin: "generated" }], quotas: [], settings: null,
};

const schedule = {
  id: "sch-1", name: "Manhã", branchId: "b1", dayOfWeek: 1, startsAt: "08:00", endsAt: "12:00", minimumBrokers: 1, maximumBrokers: 2,
  timezone: "America/Sao_Paulo", validFrom: new Date("2099-01-01T00:00:00Z"), validUntil: null, attendanceMode: "any", typeId: "t1", typeBranchIds: [],
};

const bruno = { id: "bruno", name: "Bruno", branchId: "b1" };

beforeEach(() => {
  state.queue = [];
  state.inserts = [];
  state.updates = [];
  state.transactions = 0;
  state.lockCalls = 0;
  state.events = [];
});

describe("adicionar corretor a um plantão publicado (ação de servidor)", () => {
  it("adds the broker to the published escala and to the newer draft, with no new revision and one notification", async () => {
    // Reads, in order: published plans of the months, latest revision, active schedules, planning brokers, weekly rows, dated row.
    state.queue = [[publishedPlan], [draftPlan], [schedule], [bruno], [], []];

    // The view is read at the end; with no plan left in the queue the action reports it, after the writes.
    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/Proposta não encontrada/);

    const rosterInsert = state.inserts.find((item) => item.table === schema.dutyRosterAssignments);
    expect(rosterInsert?.values).toMatchObject({ brokerId: "bruno", scheduleId: "sch-1", dutyDate: FUTURE_DAY, monthlyPlanId: "plan-9", status: "active" });
    expect(state.inserts.some((item) => item.table === schema.dutyScheduleMonthlyPlans)).toBe(false);

    const entry = { occurrenceId: OCCURRENCE_ID, brokerId: "bruno", origin: "manual", rosterAssignmentId: rosterInsert?.values.id };
    const planUpdates = state.updates.filter((item) => item.table === schema.dutyScheduleMonthlyPlans);
    expect(planUpdates[0]?.set.assignments).toEqual([entry]);
    expect(planUpdates[1]?.set.assignments).toEqual([{ occurrenceId: OCCURRENCE_ID, brokerId: "carla", origin: "generated" }, entry]);

    const notice = state.inserts.find((item) => item.table === schema.notifications);
    expect(notice?.values).toMatchObject({ recipientUserId: "bruno", type: "duty_plantao_added" });
    expect(String(notice?.values.message)).toContain("Manhã");
    // Key: the action, the plantão, the broker, the roster row and the moment of the change.
    expect(String(notice?.values.idempotencyKey)).toMatch(new RegExp(`^duty-direct:added:${OCCURRENCE_ID}:bruno:`));
  });

  it("adds straight to the published escala when there is no newer draft", async () => {
    state.queue = [[publishedPlan], [publishedPlan], [schedule], [bruno], [], []];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/Proposta não encontrada/);
    const planUpdates = state.updates.filter((item) => item.table === schema.dutyScheduleMonthlyPlans);
    expect(planUpdates).toHaveLength(1);
  });

  it("reativa a linha datada inativa e reaproveita a entrada JSON sem duplicar", async () => {
    const staleEntry = { occurrenceId: OCCURRENCE_ID, brokerId: "bruno", origin: "manual", rosterAssignmentId: DATED_ASSIGNMENT_ID };
    const stalePlan = { ...publishedPlan, assignments: [staleEntry] };
    const reactivatedPlan = { ...stalePlan, assignments: [{ ...staleEntry, origin: "manual" }] };
    state.queue = [
      [stalePlan], [stalePlan], [schedule], [bruno], [], [{ id: DATED_ASSIGNMENT_ID, status: "inactive" }],
      [reactivatedPlan], [{ id: DATED_ASSIGNMENT_ID }], [bruno],
    ];

    const view = await addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" });

    const datedUpdate = state.updates.find((item) => item.table === schema.dutyRosterAssignments);
    expect(datedUpdate?.set).toMatchObject({ status: "active", monthlyPlanId: "plan-9" });
    expect(state.inserts.some((item) => item.table === schema.dutyRosterAssignments)).toBe(false);
    const planUpdate = state.updates.find((item) => item.table === schema.dutyScheduleMonthlyPlans);
    expect(planUpdate?.set.assignments).toEqual([staleEntry]);
    expect(view.occurrences[0]?.brokers.map((broker) => broker.id)).toEqual(["bruno"]);
  });

  it("remove pela escala semanal limpa o plano publicado e o rascunho mais novo na mesma transação", async () => {
    const staleEntry = { occurrenceId: OCCURRENCE_ID, brokerId: "bruno", origin: "manual", rosterAssignmentId: DATED_ASSIGNMENT_ID };
    const stalePlan = { ...publishedPlan, assignments: [staleEntry] };
    const newerDraft = { ...draftPlan, assignments: [staleEntry, ...draftPlan.assignments] };
    const formData = new FormData();
    formData.set("assignmentId", DATED_ASSIGNMENT_ID);
    state.queue = [[{
      id: DATED_ASSIGNMENT_ID,
      branchId: "b1",
      scheduleId: "sch-1",
      brokerId: "bruno",
      dutyDate: FUTURE_DAY,
      startsAt: "08:00",
      endsAt: "12:00",
      monthlyPlanId: "plan-9",
    }], [stalePlan], [newerDraft]];

    await expect(removeRosterAssignmentAction({}, formData)).resolves.toMatchObject({ success: true });

    expect(state.transactions).toBe(1);
    expect(state.lockCalls).toBe(1);
    expect(state.events.slice(0, 2)).toEqual(["lock", "select"]);
    const planUpdates = state.updates.filter((item) => item.table === schema.dutyScheduleMonthlyPlans);
    expect(planUpdates.map((item) => item.set.assignments)).toEqual([[], draftPlan.assignments]);
  });

  it("remove uma ocorrência encerrada sem alterar o JSON histórico", async () => {
    const formData = new FormData();
    formData.set("assignmentId", DATED_ASSIGNMENT_ID);
    state.queue = [[{
      id: DATED_ASSIGNMENT_ID,
      branchId: "b1",
      scheduleId: "sch-1",
      brokerId: "bruno",
      dutyDate: "2020-01-05",
      startsAt: "08:00",
      endsAt: "12:00",
    }]];

    await expect(removeRosterAssignmentAction({}, formData)).resolves.toMatchObject({ success: true });

    expect(state.lockCalls).toBe(1);
    expect(state.events.slice(0, 2)).toEqual(["lock", "select"]);
    expect(state.updates.some((item) => item.table === schema.dutyScheduleMonthlyPlans)).toBe(false);
    expect(state.updates.find((item) => item.table === schema.dutyRosterAssignments)?.set).toMatchObject({ status: "inactive" });
  });

  it("não leva ao rascunho novo uma entrada obsoleta ligada a uma linha inativa", async () => {
    const typeId = "7ee1c683-5440-4eb8-b36e-0905c1f95e00";
    const staleOccurrence = { ...occurrence, id: "sch-old:2099-10-10", scheduleId: "sch-old", dutyDate: "2099-10-10", typeId: "t2" };
    const generationSchedule = { ...schedule, typeId };
    const latest = {
      ...draftPlan,
      occurrences: [staleOccurrence],
      assignments: [{ occurrenceId: staleOccurrence.id, brokerId: "bruno", origin: "manual", rosterAssignmentId: DATED_ASSIGNMENT_ID }],
      revision: 10,
      settings: null,
    };
    state.queue = [[latest], [generationSchedule], [], [bruno], [], []];

    await expect(generateMonthlyDutyPlanAction({
      monthKey: "2099-10",
      rangeFrom: "2099-10-19",
      rangeUntil: "2099-10-19",
      typeKeys: [typeId],
      brokers: [{ brokerId: "bruno", modality: "any", seats: { [typeId]: 1 }, forcedTypeKeys: [] }],
    })).rejects.toThrow(/proposta foi gerada|não pôde ser carregada/i);

    const createdDraft = state.inserts.find((item) => item.table === schema.dutyScheduleMonthlyPlans)?.values as { assignments?: unknown[] } | undefined;
    expect(createdDraft?.assignments).not.toContainEqual(expect.objectContaining({ occurrenceId: staleOccurrence.id, brokerId: "bruno" }));
  });

  it("publica sem recriar quem só aparece numa entrada obsoleta", async () => {
    const liveRowId = "4b64da33-01da-4ef7-a204-0023fb93d116";
    const carla = { id: "carla", name: "Carla", branchId: "b1" };
    const publishable = {
      ...draftPlan,
      id: "4e957089-39c7-4d9e-9d0b-5401fbfbc33a",
      assignments: [
        { occurrenceId: OCCURRENCE_ID, brokerId: "bruno", origin: "manual", rosterAssignmentId: DATED_ASSIGNMENT_ID },
        { occurrenceId: OCCURRENCE_ID, brokerId: "carla", origin: "manual", rosterAssignmentId: liveRowId },
      ],
      settings: null,
    };
    const eligibleSchedule = { ...schedule, dayOfWeek: 2, typeBranchIds: ["b1"] };
    state.queue = [[publishable], [publishable], [], [{ id: liveRowId }], [eligibleSchedule], [bruno, carla], [], []];

    const outcome = await publishMonthlyDutyPlanAction(publishable.id).then(() => "resolved", (error: unknown) => String(error));
    expect(outcome).toMatch(/escala publicada, mas não pôde ser carregada/i);

    const datedRows = state.inserts.find((item) => item.table === schema.dutyRosterAssignments)?.values.rows as Array<{ brokerId: string }> | undefined;
    expect(datedRows?.map((row) => row.brokerId)).toEqual(["carla"]);
    const planUpdate = state.updates.find((item) => item.table === schema.dutyScheduleMonthlyPlans);
    expect(planUpdate?.set.assignments).toEqual([expect.objectContaining({
      occurrenceId: OCCURRENCE_ID,
      brokerId: "carla",
      origin: "manual",
    })]);
  });

  it("não mostra como escalada a entrada ligada a uma linha datada inativa", async () => {
    const staleEntry = { occurrenceId: OCCURRENCE_ID, brokerId: "bruno", origin: "manual", rosterAssignmentId: DATED_ASSIGNMENT_ID };
    const stalePlan = { ...publishedPlan, assignments: [staleEntry] };
    state.queue = [[stalePlan], [], [bruno]];

    const view = await getMonthlyDutyPlanAction("2099-10");

    expect(view?.occurrences[0]?.brokers).toEqual([]);
    expect(view?.totalAssigned).toBe(0);
  });

  it("refuses a broker who is not an active broker of the tenant", async () => {
    state.queue = [[publishedPlan], [publishedPlan], [schedule], [{ id: "carla", name: "Carla", branchId: "b1" }], []];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/fora da corretora/);
    expect(state.inserts).toHaveLength(0);
  });

  it("refuses a broker already on the weekly roster that covers the day", async () => {
    state.queue = [[publishedPlan], [publishedPlan], [schedule], [bruno], [{ id: "weekly-1", validFrom: new Date("2099-01-01T00:00:00Z"), validUntil: null }]];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/escala semanal/);
    expect(state.inserts).toHaveLength(0);
  });

  it("ignores a weekly row whose validity ended before the plantão", async () => {
    state.queue = [[publishedPlan], [publishedPlan], [schedule], [bruno], [{ id: "weekly-old", validFrom: new Date("2098-01-01T00:00:00Z"), validUntil: new Date("2098-06-01T00:00:00Z") }], []];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/Proposta não encontrada/);
    expect(state.inserts.some((item) => item.table === schema.dutyRosterAssignments)).toBe(true);
  });

  it("refuses a plantão that already ended", async () => {
    const past = { ...publishedPlan, monthKey: "2020-01", occurrences: [{ ...occurrence, dutyDate: "2020-01-05", id: "sch-1:2020-01-05" }] };
    state.queue = [[past], [past]];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: "sch-1:2020-01-05", brokerId: "bruno" })).rejects.toThrow(/já terminou/);
    expect(state.inserts).toHaveLength(0);
  });
});
