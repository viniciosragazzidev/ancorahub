import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { summarizeWhatsAppActivity } from "./whatsapp-activity";
import { brokerWhatsAppMembershipScope, brokerWhatsAppMessageSourceCondition, isRecentWhatsAppReplyFilter } from "./whatsapp-activity-query";
import { schema } from "@/shared/db";

describe("summarizeWhatsAppActivity", () => {
  it("sums distinct-lead counts already aggregated by SQL and sorts connected brokers by count", () => {
    expect(summarizeWhatsAppActivity([
      { id: "b1", name: "Ana", connected: true, leadCount: 2 },
      { id: "b2", name: "Bruno", connected: false, leadCount: 99 },
      { id: "b3", name: "Carla", connected: true, leadCount: "5" },
      { id: "b4", name: "Dora", connected: true, leadCount: 0 },
    ])).toEqual({
      connectedBrokerCount: 3,
      totalLeads: 7,
      brokers: [
        { id: "b3", name: "Carla", leadCount: 5 },
        { id: "b1", name: "Ana", leadCount: 2 },
        { id: "b4", name: "Dora", leadCount: 0 },
      ],
    });
  });

  it("returns an empty summary when no personal connection is connected", () => {
    expect(summarizeWhatsAppActivity([{ id: "b1", name: "Ana", connected: false, leadCount: 4 }])).toEqual({
      connectedBrokerCount: 0,
      totalLeads: 0,
      brokers: [],
    });
  });
});

describe("brokerWhatsAppMessageSourceCondition", () => {
  it("accepts the broker's ready personal session or an untagged legacy WAHA row", () => {
    const query = new PgDialect().sqlToQuery(brokerWhatsAppMessageSourceCondition({
      tenantId: "tenant-1",
      brokerUserId: schema.tenantMemberships.userId,
      message: schema.whatsappMessages,
    }));

    expect(query.sql).toContain('"whatsapp_connections"."id" = "whatsapp_messages"."whatsapp_connection_id"');
    expect(query.sql).toContain('"whatsapp_connections"."user_id" = "tenant_memberships"."user_id"');
    expect(query.sql).toContain('"whatsapp_connections"."status" = \'ready\'');
    expect(query.sql).toContain('"whatsapp_messages"."whatsapp_connection_id" is null');
    expect(query.sql).toContain('"whatsapp_messages"."waha_number_id" is null');
    expect(query.sql).toContain('"whatsapp_messages"."provider" =');
    expect(query.sql).toContain('from "waha_numbers"');
    expect(query.params).toContain("waha");
    expect(query.params).toContain("tenant-1");
  });

  it("only accepts the supported seven-day URL filter", () => {
    expect(isRecentWhatsAppReplyFilter("7d")).toBe(true);
    expect(isRecentWhatsAppReplyFilter(undefined)).toBe(false);
    expect(isRecentWhatsAppReplyFilter("30d")).toBe(false);
    expect(isRecentWhatsAppReplyFilter(["7d"])).toBe(false);
  });
});

describe("brokerWhatsAppMembershipScope", () => {
  const dialect = new PgDialect();

  it("limits managers to their unit and supervisors to their supervised brokers", () => {
    const manager = brokerWhatsAppMembershipScope({ role: "manager", branchId: "unit-1", supervisedBrokerIds: [] });
    const supervisor = brokerWhatsAppMembershipScope({ role: "supervisor", branchId: null, supervisedBrokerIds: ["broker-1", "broker-2"] });

    expect(manager).toBeDefined();
    const managerQuery = dialect.sqlToQuery(manager!);
    expect(managerQuery.sql).toContain('"tenant_memberships"."branch_id" =');
    expect(managerQuery.params).toEqual(["unit-1"]);

    expect(supervisor).toBeDefined();
    const supervisorQuery = dialect.sqlToQuery(supervisor!);
    expect(supervisorQuery.sql).toContain('"tenant_memberships"."user_id" in');
    expect(supervisorQuery.params).toEqual(["broker-1", "broker-2"]);
  });

  it("keeps directors tenant-wide and fails closed without an assigned unit or team", () => {
    expect(brokerWhatsAppMembershipScope({ role: "director", branchId: null, supervisedBrokerIds: [] })).toBeUndefined();
    expect(brokerWhatsAppMembershipScope({ role: "manager", branchId: null, supervisedBrokerIds: [] })).toBeNull();
    expect(brokerWhatsAppMembershipScope({ role: "supervisor", branchId: null, supervisedBrokerIds: [] })).toBeNull();
  });
});
