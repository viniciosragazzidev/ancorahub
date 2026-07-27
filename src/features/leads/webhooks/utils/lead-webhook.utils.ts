import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { NormalizedLeadData } from "../types/lead-webhook.types";

// ??? Token extraction ?????????????????????????????????????????????????

export function extractBearerToken(
  authorization: string | null,
): string | null {
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

// ??? Token hashing ?????????????????????????????????????????????????????

export function generateWebhookToken(): {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const rawBytes = randomBytes(32);
  const rawToken = `crt_live_${rawBytes.toString("base64url")}`;
  const tokenHash = createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const tokenPrefix = rawToken.slice(0, 12);
  return { rawToken, tokenHash, tokenPrefix };
}

export function hashWebhookToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// ??? Payload hashing (deterministic) ???????????????????????????????????

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function hashNormalizedWebhookPayload(
  payload: Record<string, unknown>,
): string {
  const normalized = sortKeys(payload);
  const serialized = JSON.stringify(normalized);
  return createHash("sha256").update(serialized).digest("hex");
}

// ??? Request ID ????????????????????????????????????????????????????????

export function resolveRequestId(
  headerValue: string | null,
): string {
  if (
    headerValue &&
    headerValue.length > 0 &&
    headerValue.length <= 64 &&
    /^[a-zA-Z0-9_-]+$/.test(headerValue)
  ) {
    return headerValue;
  }
  return randomUUID();
}

// ??? Body reader with size limit ???????????????????????????????????????

const MAX_PAYLOAD_SIZE = 32 * 1024; // 32 KB

export async function readWebhookJson(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; code: "INVALID_JSON" | "PAYLOAD_TOO_LARGE" }> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, code: "INVALID_JSON" };
  }

  if (text.length > MAX_PAYLOAD_SIZE) {
    return { ok: false, code: "PAYLOAD_TOO_LARGE" };
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, code: "INVALID_JSON" };
  }
}

// ??? Data normalization ????????????????????????????????????????????????

export function normalizeLeadName(name: string): string {
  return name.trim();
}

export function normalizeLeadPhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "");
}

export function normalizeLeadEmail(email: string | null | undefined): string | null {
  if (!email || email.trim() === "") return null;
  return email.trim().toLowerCase();
}

export function normalizeLeadSource(source: string): string {
  return source.trim().toLowerCase();
}

export function sanitizeLeadMetadata(
  metadata: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> | null {
  if (!metadata) return null;
  const ALLOWED_KEYS_LIMIT = 20;
  const MAX_VALUE_LENGTH = 500;
  const FORBIDDEN_PREFIXES = ["token", "secret", "password", "authorization", "cookie"];
  const entries = Object.entries(metadata)
    .filter(
      ([key, value]) =>
        key.length <= 64 &&
        value !== undefined &&
        !FORBIDDEN_PREFIXES.some(
          (prefix) => key.toLowerCase().startsWith(prefix),
        ),
    )
    .slice(0, ALLOWED_KEYS_LIMIT)
    .map(([key, value]) => [
      key,
      typeof value === "string" && value.length > MAX_VALUE_LENGTH
        ? value.slice(0, MAX_VALUE_LENGTH)
        : value,
    ]);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function normalizeWebhookLead(
  payload: {
    name: string;
    phone: string;
    email?: string | "";
    source: string;
    planInterest?: string;
    externalId?: string;
    branchExternalId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
): NormalizedLeadData {
  return {
    name: normalizeLeadName(payload.name),
    phone: normalizeLeadPhone(payload.phone),
    email: normalizeLeadEmail(payload.email),
    source: normalizeLeadSource(payload.source),
    planInterest: payload.planInterest?.trim() ?? null,
    externalId: payload.externalId?.trim() ?? null,
    branchExternalId: payload.branchExternalId?.trim() ?? null,
    metadata: sanitizeLeadMetadata(payload.metadata),
  };
}
