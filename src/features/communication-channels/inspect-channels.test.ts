import { describe, it, expect, vi } from "vitest";
import { config } from "dotenv";
config({ path: ".env.production" });
config({ path: ".env.local" });
config({ path: ".env.vercel.prod" });

vi.mock("server-only", () => ({}));

import { getDatabase, schema } from "@/shared/db";
import { eq, and } from "drizzle-orm";

describe("Inspect Channels isDefault and active status", () => {
  it("checks communicationChannels table in DB", async () => {
    const db = getDatabase();
    const channels = await db.select().from(schema.communicationChannels);
    console.log("\n--- ALL COMMUNICATION CHANNELS IN DB ---");
    for (const c of channels) {
      console.log(`Channel ID: ${c.id} | tenantId: ${c.tenantId} | provider: ${c.provider} | status: ${c.status} | isDefault: ${c.isDefault} | phoneNumberId: ${c.phoneNumberId}`);
    }

    // Test querying channel exact like resendInviteAction:
    for (const c of channels) {
      const [foundWithIsDefault] = await db
        .select({ id: schema.communicationChannels.id })
        .from(schema.communicationChannels)
        .where(
          and(
            eq(schema.communicationChannels.tenantId, c.tenantId),
            eq(schema.communicationChannels.provider, "meta_cloud_api"),
            eq(schema.communicationChannels.status, "active"),
            eq(schema.communicationChannels.isDefault, true),
          ),
        )
        .limit(1);

      console.log(`Tenant ${c.tenantId}: Query WITH isDefault=true returned channel?`, !!foundWithIsDefault);

      const [foundWithoutIsDefault] = await db
        .select({ id: schema.communicationChannels.id })
        .from(schema.communicationChannels)
        .where(
          and(
            eq(schema.communicationChannels.tenantId, c.tenantId),
            eq(schema.communicationChannels.provider, "meta_cloud_api"),
            eq(schema.communicationChannels.status, "active"),
          ),
        )
        .limit(1);

      console.log(`Tenant ${c.tenantId}: Query WITHOUT isDefault=true returned channel?`, !!foundWithoutIsDefault);
    }
  });
});
