import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { createExtensionRateLimiter, extensionRouteKey } from "./rate-limit";

const state = vi.hoisted(() => ({ access: vi.fn(), audit: vi.fn(), select: vi.fn(), offers: [] as unknown[], notifications: [] as unknown[], conditions: [] as unknown[] }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ select: state.select }) }));
vi.mock("@/features/browser-extension/access", () => ({ requireExtensionAccess: state.access }));
vi.mock("@/features/browser-extension/audit", () => ({ recordExtensionAudit: state.audit }));

import { GET } from "@/app/api/extension/inbox/route";

const context = { tenantId: "tenant-a", userId: "broker-a", branchId: "branch-a", role: "broker" as const, jobTitle: "broker" };
const session = { id: "session-a", userId: "broker-a", tenantId: "tenant-a", deviceId: "device-a", extensionVersion: "0.2.0" };
const offer = { id: "offer-a", leadId: "lead-a", createdAt: "2026-11-03T10:00:00.000000Z" };
function notification(overrides: Record<string, unknown> = {}) {
  return { id: "notice-a", type: "lead_reassigned", leadId: "lead-a", createdAt: "2026-11-03T10:01:00.000000Z",
    title: "NOME PRIVADO DO CLIENTE", message: "MENSAGEM PRIVADA DO CLIENTE", ...overrides };
}
function request(cursor?: string) {
  const url = new URL("https://crm.test/api/extension/inbox");
  if (cursor !== undefined) url.searchParams.set("cursor", cursor);
  return new Request(url);
}
function encodeCursor(createdAt: string, id: string) {
  return Buffer.from(JSON.stringify({ createdAt, id }), "utf8").toString("base64url");
}
function query(rows: unknown[]) {
  const result = {
    from: () => result,
    innerJoin: () => result,
    leftJoin: () => result,
    where: (condition: unknown) => { state.conditions.push(condition); return result; },
    orderBy: () => result,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.offers = [];
  state.notifications = [];
  state.conditions = [];
  state.access.mockResolvedValue({ context, session });
  state.select.mockImplementation(() => query(state.conditions.length === 0 ? state.offers : state.notifications));
});

describe("inbox da extensão, somente mocks", () => {
  it("retorna somente id, tipo, leadId e horário, sem texto das notificações", async () => {
    state.offers = [offer];
    state.notifications = [notification()];
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toEqual({ id: "offer-a", type: "lead_offer_pending", leadId: "lead-a", createdAt: offer.createdAt });
    expect(body.items[1]).toEqual({ id: "notice-a", type: "lead_reassigned", leadId: "lead-a", createdAt: notification().createdAt });
    expect(body.items.every((item: object) => Object.keys(item).sort().join(",") === "createdAt,id,leadId,type")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("NOME PRIVADO");
    expect(JSON.stringify(body)).not.toContain("MENSAGEM PRIVADA");
    expect(state.access).toHaveBeenCalledWith(expect.any(Request), "VIEW_LEAD");
  });

  it("aplica o cursor composto createdAt+id e avança para o último item novo", async () => {
    const cursor = encodeCursor("2026-11-03T10:00:00.000000Z", "notice-a");
    state.offers = [
      { ...offer, id: "offer-old", createdAt: "2026-11-03T09:59:00.000000Z" },
      { ...offer, id: "offer-new", createdAt: "2026-11-03T10:00:00.000000Z" },
    ];
    state.notifications = [
      notification({ id: "notice-before", createdAt: "2026-11-03T09:59:00.000000Z" }),
      notification({ id: "notice-a", createdAt: "2026-11-03T10:00:00.000000Z" }),
      notification({ id: "notice-z", createdAt: "2026-11-03T10:00:00.000000Z" }),
      notification({ id: "notice-later", createdAt: "2026-11-03T10:02:00.000000Z" }),
    ];

    const response = await GET(request(cursor));
    const body = await response.json();
    const decoded = JSON.parse(Buffer.from(body.cursor, "base64url").toString("utf8"));

    expect(response.status).toBe(200);
    expect(body.items.map((item: { id: string }) => item.id)).toEqual(["offer-old", "notice-z", "offer-new", "notice-later"]);
    expect(decoded).toEqual({ createdAt: "2026-11-03T10:02:00.000000Z", id: "notice-later" });
    const notificationFilter = new PgDialect().sqlToQuery(state.conditions[1] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(notificationFilter.params).toContain("2026-11-03T10:00:00.000000Z");
    expect(notificationFilter.params).toContain("notice-a");
  });

  it("responde 304 sem corpo quando não há item novo no cursor", async () => {
    state.offers = [{ ...offer, createdAt: "2026-11-03T09:59:00.000000Z" }];
    state.notifications = [notification({ createdAt: "2026-11-03T09:59:00.000000Z" })];
    const cursor = encodeCursor("2026-11-03T10:00:00.000000Z", "notice-z");

    const response = await GET(request(cursor));

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(await response.text()).toBe("");
  });

  it("filtra tipos e escopa as duas consultas por tenant e corretor", async () => {
    state.offers = [offer];
    state.notifications = [notification(), notification({ id: "private-type", type: "admin.alert" })];
    const response = await GET(request());
    const body = await response.json();

    expect(body.items.map((item: { type: string }) => item.type)).toEqual(["lead_offer_pending", "lead_reassigned"]);
    const dialect = new PgDialect();
    const offerFilter = dialect.sqlToQuery(state.conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
    const notificationFilter = dialect.sqlToQuery(state.conditions[1] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(offerFilter.params).toEqual(expect.arrayContaining(["tenant-a", "broker-a", "PENDING", "SENT", "DELIVERED", "READ"]));
    expect(notificationFilter.params).toEqual(expect.arrayContaining(["tenant-a", "broker-a", "agent.lead_assigned", "lead_reassigned", "lead_client_returned", "task_overdue", "lead_feedback_overdue", "lead_feedback_reminder", "lead_warning_10m", "lead_lost", "lead_reopened"]));
    expect(notificationFilter.sql).toContain('"recipient_user_id"');
    expect(notificationFilter.sql).toContain('"tenant_id"');
  });

  it("usa limite próprio de 200 consultas por hora", async () => {
    const limiter = createExtensionRateLimiter();
    state.access.mockImplementation(async (incoming: Request) => {
      limiter(extensionRouteKey(incoming), session.id, 0);
      return { context, session };
    });

    let last: Response | undefined;
    for (let index = 0; index < 201; index++) last = await GET(request());

    expect(last?.status).toBe(429);
    expect(await last?.json()).toEqual({ error: "RATE_LIMITED" });
    expect(Number(last?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
