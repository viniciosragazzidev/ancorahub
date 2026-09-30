import "server-only";

import { randomUUID } from "node:crypto";

import { getDatabase, schema } from "@/shared/db";

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };

/**
 * Records one call to an external AI model (which model, tokens, time and,
 * when the provider reports it, the cost), so the team sees what the AI
 * really costs. Never throws: a failed log never breaks the attendance.
 */
export async function logAiUsage(input: {
  tenantId: string;
  /** What used the model, e.g. "lateral_answer" or "situation_learning". */
  purpose: string;
  model: string;
  startedAt: number;
  usage?: Usage | null;
  success: boolean;
  error?: string | null;
  conversationId?: string | null;
  leadId?: string | null;
}) {
  try {
    await getDatabase().insert(schema.aiAttendanceLogs).values({
      id: `log_${input.purpose}_${randomUUID()}`,
      tenantId: input.tenantId,
      conversationId: input.conversationId ?? null,
      leadId: input.leadId ?? null,
      provider: input.purpose,
      modelUsed: input.model || "unknown",
      promptTokens: input.usage?.prompt_tokens ?? 0,
      completionTokens: input.usage?.completion_tokens ?? 0,
      totalTokens: input.usage?.total_tokens ?? 0,
      estimatedCost: typeof input.usage?.cost === "number" ? String(input.usage.cost) : "0",
      latencyMs: Math.max(0, Date.now() - input.startedAt),
      status: input.success ? "success" : "failed",
      errorMessage: input.error?.slice(0, 240) ?? null,
    });
  } catch (error) {
    console.warn("[ai-usage] log_failed", { purpose: input.purpose, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
  }
}

/** Calls made today (UTC) for a purpose, to respect a per-tenant daily limit. */
export async function countAiCallsToday(tenantId: string, purpose: string) {
  const { and, eq, gte, sql } = await import("drizzle-orm");
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [row] = await getDatabase().select({ total: sql<number>`count(*)::int` }).from(schema.aiAttendanceLogs).where(and(
    eq(schema.aiAttendanceLogs.tenantId, tenantId),
    eq(schema.aiAttendanceLogs.provider, purpose),
    gte(schema.aiAttendanceLogs.createdAt, since),
  ));
  return row?.total ?? 0;
}
