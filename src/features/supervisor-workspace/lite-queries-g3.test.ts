import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  queued: [] as unknown[][],
  selects: 0,
}));
const mockLiteAudience = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mockLiteAudience }));
vi.mock("@/features/broker-workspace/manager-unit-scope", () => ({ getManagerUnitScope: () => null }));
vi.mock("@/features/team/supervisor-scope", () => ({ inSupervisorTeam: () => true, isSupervisorTeamScoped: () => true }));
vi.mock("@/features/supervisor-workspace/queries", () => ({ getSupervisorWorkspaceData: vi.fn() }));
vi.mock("@/features/engagement/broker-stats", () => ({ getTeamOfferStats: vi.fn(), statsWindow: vi.fn() }));
vi.mock("@/features/lead-distribution/monthly-duty-plan", () => ({ addDays: (key: string) => key, zonedMidnight: () => new Date("2026-10-15T03:00:00.000Z") }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return {
    ...actual,
    getDatabase: () => ({
      select: () => {
        mockState.selects += 1;
        const rows = mockState.queued.shift() ?? [];
        const query = {
          from: () => query,
          innerJoin: () => query,
          where: () => query,
          orderBy: () => query,
          limit: async () => rows,
        };
        return query;
      },
    }),
  };
});

import { getSupervisorLiteNextTask, getSupervisorLiteRecognitions, getSupervisorLiteWhatsAppStatus } from "./lite-queries";

const supervisorContext = {
  userId: "supervisor-1",
  tenantId: "tenant-1",
  role: "supervisor",
  branchId: "branch-1",
  supervisorTeamScope: true,
} as const;

beforeEach(() => {
  mockState.queued = [];
  mockState.selects = 0;
  mockLiteAudience.mockResolvedValue("supervisor");
});

describe("G3 broker profile queries respect the viewer's scope", () => {
  it("returns no recognitions and no next task for a broker outside the supervisor's team", async () => {
    mockState.queued = [[]]; // membership lookup finds nothing in the team

    await expect(getSupervisorLiteRecognitions({ context: supervisorContext as never, memberId: "broker-x" })).resolves.toEqual([]);
    await expect(getSupervisorLiteNextTask({ context: supervisorContext as never, memberId: "broker-x" })).resolves.toBeNull();
    // Only the membership check ran: the data queries never reached the database.
    expect(mockState.selects).toBe(2);
  });

  it("returns nothing when the viewer is not in a Lite team audience", async () => {
    mockLiteAudience.mockResolvedValue("manager");

    await expect(getSupervisorLiteRecognitions({ context: supervisorContext as never, memberId: "broker-1" })).resolves.toEqual([]);
    expect(mockState.selects).toBe(0);
  });

  it("maps the recognition bonuses of a team broker and falls back when the reason is missing", async () => {
    const occurredAt = new Date("2026-10-12T15:00:00.000Z");
    mockState.queued = [
      [{ id: "broker-1" }],
      [
        { id: "ev-1", points: 15, occurredAt, metadata: { reason: "Virada de meta", senderRole: "supervisor" } },
        { id: "ev-2", points: 5, occurredAt, metadata: {} },
      ],
    ];

    await expect(getSupervisorLiteRecognitions({ context: supervisorContext as never, memberId: "broker-1" })).resolves.toEqual([
      { id: "ev-1", points: 15, reason: "Virada de meta", occurredAt: "2026-10-12T15:00:00.000Z", senderRole: "supervisor" },
      { id: "ev-2", points: 5, reason: "Reconhecimento", occurredAt: "2026-10-12T15:00:00.000Z", senderRole: null },
    ]);
  });

  it("returns the earliest open task with its lead for a team broker", async () => {
    mockState.queued = [
      [{ id: "broker-1" }],
      [{ taskId: "task-1", title: "Retornar cotação", dueAt: new Date("2026-10-14T12:00:00.000Z"), leadId: "lead-1", leadName: "Maria" }],
    ];

    await expect(getSupervisorLiteNextTask({ context: supervisorContext as never, memberId: "broker-1" })).resolves.toEqual({
      taskId: "task-1",
      title: "Retornar cotação",
      dueAt: "2026-10-14T12:00:00.000Z",
      leadId: "lead-1",
      leadName: "Maria",
    });
  });

  it("reports the WhatsApp as connected only for a ready connection of the broker, with its date", async () => {
    const connectedAt = new Date("2026-09-01T15:00:00.000Z");
    mockState.queued = [[{ id: "broker-1" }], [{ connectedAt }]];

    await expect(getSupervisorLiteWhatsAppStatus({ context: supervisorContext as never, memberId: "broker-1" })).resolves.toEqual({ connected: true, connectedAt: "2026-09-01T15:00:00.000Z" });
  });

  it("reports not connected when the broker has no ready connection", async () => {
    mockState.queued = [[{ id: "broker-1" }], []];

    await expect(getSupervisorLiteWhatsAppStatus({ context: supervisorContext as never, memberId: "broker-1" })).resolves.toEqual({ connected: false, connectedAt: null });
  });

  it("returns null for a WhatsApp status outside the viewer scope", async () => {
    mockState.queued = [[]];

    await expect(getSupervisorLiteWhatsAppStatus({ context: supervisorContext as never, memberId: "broker-x" })).resolves.toBeNull();
  });
});
