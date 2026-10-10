import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: vi.fn() }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: {}, getFeatureFlag: vi.fn() }));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));
vi.mock("./queries", () => ({ getSupervisorWorkspaceData: vi.fn() }));

import { buildDigestLines } from "./digest";

describe("supervisor digest", () => {
  it("sums the team's day in up to 5 lines", () => {
    const lines = buildDigestLines({
      viewer: { userId: "s", tenantId: "t", name: "Carla", branchName: null },
      team: [
        { userId: "b1", name: "Ana Lima", availability: "available", inService: 2, waiting: 1, late: 2, receivedToday: 3, stats: { brokerId: "b1", offered: 5, accepted: 4, medianAcceptSeconds: 50 }, ranks: [] },
      ],
      freeBrokers: [],
      duty: [],
      goal: { name: "Outubro", percentage: 40, currentValue: "4", targetValue: "10" },
      today: { receivedToday: 3, inService: 2, waiting: 1, late: 2 },
      attention: [],
      unreadNotifications: 0,
      latestNotificationTitle: null,
      slaMinutes: 15,
      updatedAt: new Date(),
    });
    expect(lines).toEqual([
      "Hoje a equipe recebeu 3 lead(s) e tem 2 em atendimento.",
      "2 lead(s) seguem sem primeiro contato além do prazo.",
      "Destaque da semana: Ana, 4 aceites (aceita em 50 s).",
      "Converse com Ana amanhã: 2 lead(s) atrasado(s).",
      "Meta da equipe: 40% (4 de 10).",
    ]);
  });
});
