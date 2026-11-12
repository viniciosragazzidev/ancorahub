import "server-only";
import { and, eq, or } from "drizzle-orm";
import { schema } from "@/shared/db";
import type { ErpDatabase } from "./access";
import { checkedCents, settledCents } from "./ledger";

export async function getEntryOffsets(db: ErpDatabase, tenantId: string, entryId: string) {
  const rows = await db.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, tenantId), or(eq(schema.erpOffsets.advanceEntryId, entryId), eq(schema.erpOffsets.commissionEntryId, entryId))));
  return { rows, confirmed: settledCents(rows), reserved: checkedCents(rows.filter((row) => row.status === "pending" && row.kind === "allocation").reduce((sum, row) => sum + BigInt(row.amountCents), BigInt(0))) };
}
