import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: { tenantId: "tenant-1", userId: "director-1", role: "director", branchId: null as string | null },
  selectResults: [] as unknown[][],
  inserted: [] as unknown[],
  brokerSend: vi.fn(async () => ({ notified: true })),
  directorSend: vi.fn(async () => ({ notified: 1 })),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => mocks.context }));
vi.mock("@/shared/auth/authorization", () => ({ requireCapability: vi.fn(async () => undefined) }));
vi.mock("@/features/team-notices/catalog", () => ({ teamNoticeByKey: (key: string) => ({ key }) }));
vi.mock("@/features/team-notices/service", () => ({ getTeamNoticeSetting: async () => ({ enabled: true }) }));
vi.mock("./closing-director-alert", () => ({
  getClosingDirectorRecipients: async () => ["5521999990000"],
  notifyDirectorsClosingStage: mocks.directorSend,
}));
vi.mock("./closing-stage-notice", () => ({ manuallyNotifyBrokerClosingStage: mocks.brokerSend }));
vi.mock("@/shared/db", () => ({
  schema: {
    leads: { id: "lead.id", tenantId: "lead.tenantId", nome: "lead.nome", status: "lead.status", corretorId: "lead.brokerId", branchId: "lead.branchId", deletedAt: "lead.deletedAt", archivedAt: "lead.archivedAt" },
    brokerProfiles: { tenantId: "broker.tenantId", userId: "broker.userId", phone: "broker.phone" },
    whatsappOutboundMessages: {
      tenantId: "out.tenantId", idempotencyKey: "out.key", status: "out.status",
      sentAt: "out.sentAt", queuedAt: "out.queuedAt", failedAt: "out.failedAt", createdAt: "out.createdAt",
    },
    auditLogs: "auditLogs",
  },
  getDatabase: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.selectResults.shift() ?? [] }) }) }),
    insert: () => ({ values: async (value: unknown) => { mocks.inserted.push(value); } }),
  }),
}));

import { sendClosingNoticesRecoveryAction } from "./closing-notices-recovery-action";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const BROKER_KEY = `lead-closing-stage:${LEAD_ID}:broker-1`;
const DIRECTOR_KEY = `lead-closing-director:${LEAD_ID}:5521999990000`;
const lead = { id: LEAD_ID, name: "Andrea", status: "documentation_pending", brokerId: "broker-1", branchId: "branch-1" };
const brokerProfile = [{ phone: "5521888880000" }];
const sentBroker = { idempotencyKey: BROKER_KEY, status: "sent", sentAt: new Date("2026-11-03T23:09:00.000Z"), queuedAt: null, failedAt: null, createdAt: new Date("2026-11-03T23:08:00.000Z") };
const sentDirector = { idempotencyKey: DIRECTOR_KEY, status: "sent", sentAt: new Date("2026-11-03T23:10:00.000Z"), queuedAt: null, failedAt: null, createdAt: new Date("2026-11-03T23:09:00.000Z") };
const queuedBroker = { ...sentBroker, status: "queued", sentAt: null, queuedAt: new Date("2026-11-03T23:11:00.000Z") };
const queuedDirector = { ...sentDirector, status: "queued", sentAt: null, queuedAt: new Date("2026-11-03T23:12:00.000Z") };

beforeEach(() => {
  mocks.context = { tenantId: "tenant-1", userId: "director-1", role: "director", branchId: null };
  mocks.selectResults = [];
  mocks.inserted = [];
  mocks.brokerSend.mockClear();
  mocks.directorSend.mockClear();
  mocks.revalidate.mockClear();
});

describe("ação conjunta de recuperação dos avisos de fechamento", () => {
  it("envia somente à direção quando faltam os parabéns já registrados", async () => {
    mocks.selectResults = [[lead], brokerProfile, [sentBroker], [sentBroker, queuedDirector]];

    const result = await sendClosingNoticesRecoveryAction(LEAD_ID);

    expect(result.success).toBe(true);
    expect(mocks.brokerSend).not.toHaveBeenCalled();
    expect(mocks.directorSend).toHaveBeenCalledWith(expect.objectContaining({ recipientPhones: ["5521999990000"], manual: true }));
  });

  it("envia somente os parabéns quando o aviso à direção já foi registrado", async () => {
    mocks.selectResults = [[lead], brokerProfile, [sentDirector], [sentDirector, queuedBroker]];

    const result = await sendClosingNoticesRecoveryAction(LEAD_ID);

    expect(result.success).toBe(true);
    expect(mocks.brokerSend).toHaveBeenCalledWith(expect.objectContaining({ leadId: LEAD_ID, brokerId: "broker-1" }));
    expect(mocks.directorSend).not.toHaveBeenCalled();
  });

  it("envia os dois quando ambos faltam", async () => {
    mocks.selectResults = [[lead], brokerProfile, [], [queuedBroker, queuedDirector]];

    const result = await sendClosingNoticesRecoveryAction(LEAD_ID);

    expect(result.success).toBe(true);
    expect(mocks.brokerSend).toHaveBeenCalledTimes(1);
    expect(mocks.directorSend).toHaveBeenCalledTimes(1);
  });

  it("não repete quando ambos já foram enviados e registra a auditoria", async () => {
    mocks.selectResults = [[lead], brokerProfile, [sentBroker, sentDirector], [sentBroker, sentDirector]];

    const result = await sendClosingNoticesRecoveryAction(LEAD_ID);

    expect(result).toMatchObject({ success: true, summary: "Parabéns: enviado 03/11 20:09 · Direção: enviado 03/11 20:10" });
    expect(mocks.brokerSend).not.toHaveBeenCalled();
    expect(mocks.directorSend).not.toHaveBeenCalled();
    expect(mocks.inserted[0]).toMatchObject({ acao: "lead_closing_notices.recovery_triggered", metadata: { outcome: "nothing_missing" } });
  });

  it("mantém o gestor restrito à unidade do lead", async () => {
    mocks.context = { tenantId: "tenant-1", userId: "manager-1", role: "manager", branchId: "branch-2" };
    mocks.selectResults = [[lead]];

    await expect(sendClosingNoticesRecoveryAction(LEAD_ID)).resolves.toMatchObject({
      success: false,
      error: "Lead fora da sua unidade.",
    });
    expect(mocks.brokerSend).not.toHaveBeenCalled();
    expect(mocks.directorSend).not.toHaveBeenCalled();
  });
});
