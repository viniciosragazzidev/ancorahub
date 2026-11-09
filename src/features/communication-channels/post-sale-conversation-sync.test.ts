import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  selectConditions: [] as unknown[],
  insertedValues: null as Record<string, unknown> | null,
  insertedRows: [] as Array<{ id: string }>,
  updatedValues: null as Record<string, unknown> | null,
  updatedCondition: null as unknown,
  updatedRows: [] as Array<{ id: string }>,
  outbound: null as Record<string, unknown> | null,
  lead: null as Record<string, unknown> | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/realtime-sync", () => ({ publishConversationInvalidation: mocks.publish }));
vi.mock("@/shared/db", async () => {
  const actual = await vi.importActual<typeof import("@/shared/db")>("@/shared/db");
  return { ...actual, getDatabase: () => ({ select: mocks.select, insert: mocks.insert, update: mocks.update }) };
});

import { schema } from "@/shared/db";
import { syncPostSaleConversationMessage } from "./post-sale-conversation-sync";

function selectQuery(table: unknown) {
  const rows = [table === schema.whatsappOutboundMessages ? mocks.outbound : mocks.lead];
  const query = {
    where: (condition: unknown) => {
      mocks.selectConditions.push(condition);
      return query;
    },
    limit: () => query,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectConditions = [];
  mocks.insertedValues = null;
  mocks.insertedRows = [{ id: "post_sale_outbound_outbound-a" }];
  mocks.updatedValues = null;
  mocks.updatedCondition = null;
  mocks.updatedRows = [{ id: "post_sale_outbound_outbound-a" }];
  mocks.outbound = {
    id: "outbound-a",
    tenantId: "tenant-a",
    recipientType: "lead",
    recipientId: "lead-a",
    channelId: "channel-a",
    deliveryRoute: "meta_only",
    wahaNumberId: null,
    templateName: "pos_venda_apresentacao",
    variables: ["Neide", "Âncora Saúde", "Alan"],
    renderedBody: null,
    providerMessageId: "wamid.123",
    status: "read",
    destinationPhone: "+5522992843",
    sentAt: new Date("2026-11-09T11:00:00Z"),
  };
  mocks.lead = { id: "lead-a" };
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => selectQuery(table) }));
  mocks.insert.mockReturnValue({
    values: (values: Record<string, unknown>) => {
      mocks.insertedValues = values;
      return { onConflictDoNothing: () => ({ returning: async () => mocks.insertedRows }) };
    },
  });
  mocks.update.mockReturnValue({
    set: (values: Record<string, unknown>) => {
      mocks.updatedValues = values;
      return { where: (condition: unknown) => ({ returning: async () => {
        mocks.updatedCondition = condition;
        return mocks.updatedRows;
      } }) };
    },
  });
  mocks.publish.mockResolvedValue(undefined);
});

describe("post-sale conversation history sync", () => {
  it("mirrors an accepted Meta template under the same tenant and lead", async () => {
    expect(await syncPostSaleConversationMessage({ tenantId: "tenant-a", outboundId: "outbound-a" })).toBe(true);

    expect(mocks.insertedValues).toMatchObject({
      id: "post_sale_outbound_outbound-a",
      tenantId: "tenant-a",
      leadId: "lead-a",
      communicationChannelId: "channel-a",
      provider: "meta_cloud",
      messageId: "wamid.123",
      providerStatus: "read",
      direction: "outbound",
      senderRole: "assistant",
      body: "Olá, Neide! Aqui é da equipe de qualidade da Âncora Saúde. Há alguns dias você falou com a gente sobre plano de saúde e o corretor Alan ficou responsável pelo seu atendimento. Queremos saber como foi a sua experiência para garantir que você seja bem atendido. Posso te fazer duas perguntas rápidas?",
    });
    expect(new PgDialect().sqlToQuery(mocks.selectConditions[0] as never).params).toContain("tenant-a");
    expect(new PgDialect().sqlToQuery(mocks.selectConditions[1] as never).params).toContain("tenant-a");
    expect(mocks.publish).toHaveBeenCalledWith({ tenantId: "tenant-a" });
  });

  it("does not publish or insert when the lead is outside the outbound tenant", async () => {
    mocks.lead = null;

    expect(await syncPostSaleConversationMessage({ tenantId: "tenant-a", outboundId: "outbound-a" })).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("updates the same canonical message on a duplicate receipt without regressing status", async () => {
    mocks.insertedRows = [];

    expect(await syncPostSaleConversationMessage({ tenantId: "tenant-a", outboundId: "outbound-a" })).toBe(true);

    const updateSql = new PgDialect().sqlToQuery(mocks.updatedValues?.providerStatus as never);
    const whereSql = new PgDialect().sqlToQuery(mocks.updatedCondition as never);
    expect(updateSql.params).toContain("read");
    expect(whereSql.params).toContain("tenant-a");
    expect(whereSql.params).toContain("lead-a");
    expect(whereSql.params).toContain("wamid.123");
    expect(mocks.publish).toHaveBeenCalledWith({ tenantId: "tenant-a" });
  });
});
