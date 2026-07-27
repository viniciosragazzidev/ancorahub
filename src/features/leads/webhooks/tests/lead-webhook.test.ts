import { describe, it, expect } from "vitest";
import { leadWebhookPayloadSchema } from "../schemas/lead-webhook-payload.schema";
import {
  extractBearerToken,
  hashWebhookToken,
  hashNormalizedWebhookPayload,
  resolveRequestId,
  normalizeLeadPhone,
  normalizeLeadEmail,
  normalizeLeadName,
  normalizeLeadSource,
  sanitizeLeadMetadata,
} from "../utils/lead-webhook.utils";

// ─── extractBearerToken ───────────────────────────────────────────────

describe("extractBearerToken", () => {
  it("returns null when Authorization is missing", () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it("returns null when scheme is not Bearer", () => {
    expect(extractBearerToken("Basic dG9rZW4=")).toBeNull();
  });

  it("returns null when token is empty", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
  });

  it("extracts the token correctly", () => {
    expect(extractBearerToken("Bearer crt_live_token123")).toBe("crt_live_token123");
  });

  it("trims whitespace around the token", () => {
    expect(extractBearerToken("Bearer   crt_live_token456  ")).toBe("crt_live_token456");
  });
});

// ─── hashWebhookToken ─────────────────────────────────────────────────

describe("hashWebhookToken", () => {
  it("returns a hex string of 64 characters (SHA-256)", () => {
    const hash = hashWebhookToken("crt_live_test-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const a = hashWebhookToken("same-token");
    const b = hashWebhookToken("same-token");
    expect(a).toBe(b);
  });

  it("produces different hashes for different tokens", () => {
    const a = hashWebhookToken("token-1");
    const b = hashWebhookToken("token-2");
    expect(a).not.toBe(b);
  });
});

// ─── hashNormalizedWebhookPayload ─────────────────────────────────────

describe("hashNormalizedWebhookPayload", () => {
  it("produces a deterministic hash regardless of key order", () => {
    const a = hashNormalizedWebhookPayload({ name: "João", phone: "1199999999" });
    const b = hashNormalizedWebhookPayload({ phone: "1199999999", name: "João" });
    expect(a).toBe(b);
  });

  it("produces an ASCII hex string", () => {
    const hash = hashNormalizedWebhookPayload({ name: "Teste" });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs when payload content changes", () => {
    const a = hashNormalizedWebhookPayload({ name: "João" });
    const b = hashNormalizedWebhookPayload({ name: "Maria" });
    expect(a).not.toBe(b);
  });
});

// ─── resolveRequestId ─────────────────────────────────────────────────

describe("resolveRequestId", () => {
  it("returns the header value when valid", () => {
    expect(resolveRequestId("req-123")).toBe("req-123");
  });

  it("generates UUID when header is missing", () => {
    const id = resolveRequestId(null);
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("generates UUID when header is empty", () => {
    const id = resolveRequestId("");
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("generates UUID when header exceeds max length", () => {
    const id = resolveRequestId("a".repeat(65));
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("generates UUID when header has invalid characters", () => {
    const id = resolveRequestId("req with spaces!");
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
  });
});

// ─── Normalization ────────────────────────────────────────────────────

describe("normalizeLeadPhone", () => {
  it("removes spaces", () => {
    expect(normalizeLeadPhone("11 99999 9999")).toBe("11999999999");
  });

  it("removes punctuation", () => {
    expect(normalizeLeadPhone("+55 (21) 99999-9999")).toBe("+5521999999999");
  });

  it("removes hyphens, dots, and parentheses", () => {
    expect(normalizeLeadPhone("(11) 91234-5678")).toBe("11912345678");
  });
});

describe("normalizeLeadEmail", () => {
  it("converts to lowercase", () => {
    expect(normalizeLeadEmail("Joao@Example.COM")).toBe("joao@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeLeadEmail("  email@test.com  ")).toBe("email@test.com");
  });

  it("returns null for empty string", () => {
    expect(normalizeLeadEmail("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeLeadEmail(undefined)).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeLeadEmail("   ")).toBeNull();
  });
});

describe("normalizeLeadName", () => {
  it("trims whitespace preserving warnings", () => {
    expect(normalizeLeadName("  João Silva  ")).toBe("João Silva");
  });
});

describe("normalizeLeadSource", () => {
  it("converts to lowercase and trims", () => {
    expect(normalizeLeadSource("  Landing-Page  ")).toBe("landing-page");
  });
});

describe("sanitizeLeadMetadata", () => {
  it("returns null for undefined metadata", () => {
    expect(sanitizeLeadMetadata(undefined)).toBeNull();
  });

  it("allows valid metadata entries", () => {
    const result = sanitizeLeadMetadata({ campaign: "summer", utm_source: "google" });
    expect(result).toEqual({ campaign: "summer", utm_source: "google" });
  });

  it("filters keys with forbidden prefixes", () => {
    const result = sanitizeLeadMetadata({
      token_value: "should-not-appear",
      secret_key: "should-not-appear",
      campaign: "valid",
    });
    expect(Object.keys(result ?? {})).toEqual(["campaign"]);
  });

  it("limits to 20 keys", () => {
    const large: Record<string, number> = {};
    for (let i = 0; i < 30; i++) large[`key${i}`] = i;
    const result = sanitizeLeadMetadata(large as unknown as Record<string, string | number | boolean | null>);
    expect(Object.keys(result ?? {}).length).toBe(20);
  });
});

// ─── Zod Schema Validation ────────────────────────────────────────────

describe("leadWebhookPayloadSchema", () => {
  it("accepts a valid minimal payload", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      name: "Maria",
      phone: "+5521999999999",
      source: "landing-page",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid full payload", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      externalId: "ext-123",
      name: "Maria da Silva",
      phone: "+5521999999999",
      email: "maria@example.com",
      planInterest: "Plano Premium",
      source: "landing-page",
      branchExternalId: "matriz-01",
      metadata: { campaign: "summer" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects payload without name", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      phone: "+5521999999999",
      source: "site",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      name: "Maria",
      phone: "+5521999999999",
      source: "site",
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields via strict()", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      name: "Maria",
      phone: "+5521999999999",
      source: "site",
      tenantId: "some-tenant",
    });
    expect(result.success).toBe(false);
  });

  it("rejects assignedUserId in payload", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      name: "Maria",
      phone: "+5521999999999",
      source: "site",
      assignedUserId: "user-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short name (< 2 chars)", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      name: "A",
      phone: "+5521999999999",
      source: "site",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty email as valid", () => {
    const result = leadWebhookPayloadSchema.safeParse({
      name: "Maria",
      phone: "+5521999999999",
      source: "site",
      email: "",
    });
    expect(result.success).toBe(true);
  });
});
