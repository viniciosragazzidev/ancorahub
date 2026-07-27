import { describe, expect, it, vi } from "vitest";
import { whatsappOutboundStatusValues } from "./outbound-service";

vi.mock("server-only", () => ({}));

describe("outboundService", () => {
  it("defines supported whatsapp outbound statuses", () => {
    expect(whatsappOutboundStatusValues).toContain("pending");
    expect(whatsappOutboundStatusValues).toContain("queued");
    expect(whatsappOutboundStatusValues).toContain("sent");
    expect(whatsappOutboundStatusValues).toContain("failed");
  });
});
