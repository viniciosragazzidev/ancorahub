import { describe, expect, it } from "vitest";
import { resolvePostSaleOutboundInsert } from "./post-sale-outbound-idempotency";

describe("post-sale outbound idempotency", () => {
  it("treats an empty returning result and successful idempotency reread as the queued message", async () => {
    const readRacedRow = async () => ({ id: "existing-outbound", status: "queued" });
    await expect(resolvePostSaleOutboundInsert({
      insertedId: undefined,
      readRacedRow,
      intendedStatus: "queued",
    })).resolves.toEqual({ id: "existing-outbound", status: "queued", duplicate: true });
  });

  it("returns the newly inserted message when this request wins the race", async () => {
    await expect(resolvePostSaleOutboundInsert({ insertedId: "new-outbound", intendedStatus: "pending" }))
      .resolves.toEqual({ id: "new-outbound", status: "pending", duplicate: false });
  });
});
