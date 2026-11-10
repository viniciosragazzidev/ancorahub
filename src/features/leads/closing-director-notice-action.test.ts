import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: { tenantId: "tenant-1", userId: "director-1", role: "director", branchId: null as string | null },
  selectResults: [] as unknown[][],
  inserted: [] as unknown[],
  notify: vi.fn(async () => ({ notified: 2 })),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => mocks.context }));
vi.mock("@/shared/auth/authorization", () => ({ requireCapability: vi.fn(async () => undefined) }));
vi.mock("@/features/team-notices/catalog", () => ({ teamNoticeByKey: (key: string) => ({ key }) }));
vi.mock("@/features/team-notices/service", () => ({ getTeamNoticeSetting: async () => ({ enabled: true }) }));
vi.mock("./closing-director-alert", () => ({
  getClosingDirectorRecipients: async () => ["5521999990000", "5521888880000"],
  notifyDirectorsClosingStage: mocks.notify,
}));
vi.mock("@/shared/db", () => ({
  schema: {
    leads: { id: "lead.id", tenantId: "lead.tenantId", nome: "lead.nome", status: "lead.status", branchId: "lead.branchId", deletedAt: "lead.deletedAt", archivedAt: "lead.archivedAt" },
    whatsappOutboundMessages: { tenantId: "out.tenantId", idempotencyKey: "out.key", status: "out.status" },
    auditLogs: "auditLogs",
  },
  getDatabase: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.selectResults.shift() ?? [] }) }) }),
    insert: () => ({ values: async (value: unknown) => { mocks.inserted.push(value); } }),
  }),
}));

import { sendMissedClosingDirectorNoticeAction } from "./closing-director-notice-action";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const KEY_A = `lead-closing-director:${LEAD_ID}:5521999990000`;
const KEY_B = `lead-closing-director:${LEAD_ID}:5521888880000`;
const lead = { id: LEAD_ID, name: "Andrea", status: "documentation_pending", branchId: "branch-1" };

beforeEach(() => {
  mocks.context = { tenantId: "tenant-1", userId: "director-1", role: "director", branchId: null };
  mocks.selectResults = [];
  mocks.inserted = [];
  mocks.notify.mockClear();
  mocks.revalidate.mockClear();
});

describe("aviso manual à direção em lead no fechamento", () => {
  it("envia pelo fluxo idempotente por telefone e audita o resultado", async () => {
    mocks.selectResults = [
      [lead],
      [],
      [{ idempotencyKey: KEY_A, status: "queued" }, { idempotencyKey: KEY_B, status: "queued" }],
    ];

    await expect(sendMissedClosingDirectorNoticeAction(LEAD_ID)).resolves.toEqual({ success: true, message: "Aviso colocado na fila para a direção." });
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ leadId: LEAD_ID, newStatus: "documentation_pending", manual: true }));
    expect(mocks.inserted).toHaveLength(1);
    expect(mocks.inserted[0]).toMatchObject({ acao: "lead_closing_director.manual_triggered", entidadeId: LEAD_ID, metadata: { outcome: "queued", recipientCount: 2 } });
  });

  it("limita gestor à própria unidade", async () => {
    mocks.context = { tenantId: "tenant-1", userId: "manager-1", role: "manager", branchId: "branch-2" };
    mocks.selectResults = [[lead]];

    await expect(sendMissedClosingDirectorNoticeAction(LEAD_ID)).resolves.toEqual({ success: false, error: "Lead fora da sua unidade." });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("não repete o aviso quando todos os números já receberam registro", async () => {
    mocks.selectResults = [[lead], [{ idempotencyKey: KEY_A }, { idempotencyKey: KEY_B }]];

    await expect(sendMissedClosingDirectorNoticeAction(LEAD_ID)).resolves.toEqual({ success: false, error: "O aviso já foi registrado para todos os números da direção." });
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.inserted).toHaveLength(0);
  });

  it("envia só aos números sem registro prévio", async () => {
    mocks.selectResults = [
      [lead],
      [{ idempotencyKey: KEY_A }],
      [{ idempotencyKey: KEY_A, status: "sent" }, { idempotencyKey: KEY_B, status: "queued" }],
    ];

    await expect(sendMissedClosingDirectorNoticeAction(LEAD_ID)).resolves.toEqual({ success: true, message: "Aviso colocado na fila para a direção." });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.inserted[0]).toMatchObject({ metadata: { outcome: "queued", recipientCount: 1 } });
  });
});
