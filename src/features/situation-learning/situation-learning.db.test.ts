/**
 * Learning of situations against the real schema, inside one transaction that
 * is ROLLED BACK, with a fake AI. Opt-in only (never part of the normal suite):
 *   RUN_SITUATION_LEARNING_DB_E2E=1 npx vitest run src/features/situation-learning/situation-learning.db.test.ts
 */
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state: { tx: unknown; aiReply: string } = { tx: null, aiReply: "" };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/features/notifications/send-push-helper", () => ({ sendNotificationToUser: vi.fn(async () => undefined) }));
vi.mock("@/features/ai-agent/model-router", () => ({
  createAiRouter: async () => ({
    providers: ["openrouter"],
    call: async () => ({
      model: "fake/model",
      provider: "openrouter",
      response: new Response(JSON.stringify({ choices: [{ message: { content: state.aiReply } }], usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } })),
    }),
  }),
}));

const enabled = process.env.RUN_SITUATION_LEARNING_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("situation learning (rolled back)", () => {
  it("records questions, groups them into a suggestion, tells the directors and, when on, activates it", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId, userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      expect(director).toBeTruthy();
      const tenantId = director!.tenantId;
      const { recordLearningEvent, runSituationLearningJob, getLearningOverview } = await import("./service");

      // L1: a covered question and five uncovered ones (with personal data to remove).
      await recordLearningEvent({ tenantId, question: "quanto custa?", matchedSituationKey: "faq.price" });
      for (const question of ["atendem em Niterói?", "tem em niteroi? meu cel 21987654321", "vale em Niterói?", "atende Niterói?", "cobre Niterói?"]) {
        await recordLearningEvent({ tenantId, question, aiAnswer: "O corretor detalha na cotação." });
      }
      const events = await tx.select().from(s.situationLearningEvents).where(eq(s.situationLearningEvents.tenantId, tenantId));
      expect(events).toHaveLength(6);
      expect(events.some((event) => event.question.includes("21987654321"))).toBe(false);

      // L2: the fake AI groups the five uncovered questions into one new situation.
      state.aiReply = JSON.stringify({ groups: [{ questionIds: ["q1", "q2", "q3", "q4", "q5"], target: "new", title: "Atendem em Niterói?", phrases: ["atendem em niteroi"], responses: ["Atendemos Niterói sim, {{nome}}! O corretor detalha as opções na cotação.", "R$ 10,00"], action: "continue" }] });
      const first = await runSituationLearningJob();
      expect(first.tenants.find((result) => result.tenantId === tenantId)).toMatchObject({ groups: 1, suggestions: 1, notified: 1, activated: 0 });
      const overview = await getLearningOverview(tenantId);
      expect(overview.suggestions).toHaveLength(1);
      expect(overview.suggestions[0]).toMatchObject({ kind: "new", title: "Atendem em Niterói?", occurrences: 5, responses: ["Atendemos Niterói sim, {{nome}}! O corretor detalha as opções na cotação."] });
      expect(overview.coverage).toEqual({ percent: 17, covered: 1, total: 6 });
      const notices = await tx.select().from(s.notifications).where(and(eq(s.notifications.tenantId, tenantId), eq(s.notifications.type, "situation_suggestion")));
      expect(notices.length).toBeGreaterThan(0);
      const usage = await tx.select().from(s.aiAttendanceLogs).where(and(eq(s.aiAttendanceLogs.tenantId, tenantId), eq(s.aiAttendanceLogs.provider, "situation_learning")));
      expect(usage[0]).toMatchObject({ modelUsed: "fake/model", totalTokens: 150, status: "success" });

      // L5: with automatic activation on, three more questions join the suggestion and it becomes a situation.
      await tx.insert(s.systemSettings).values({ key: `situation_learning_auto_activate_${tenantId}`, value: "true" })
        .onConflictDoUpdate({ target: s.systemSettings.key, set: { value: "true" } });
      for (const question of ["niteroi vocês atendem?", "atendimento em niteroi?", "tem cobertura em Niterói?"]) await recordLearningEvent({ tenantId, question });
      state.aiReply = JSON.stringify({ groups: [{ questionIds: ["q1", "q2", "q3"], target: "suggestion", suggestionId: "s1" }] });
      const second = await runSituationLearningJob();
      expect(second.tenants.find((result) => result.tenantId === tenantId)).toMatchObject({ activated: 1 });
      const [situation] = await tx.select().from(s.attendanceSituations).where(and(eq(s.attendanceSituations.tenantId, tenantId), eq(s.attendanceSituations.origin, "auto")));
      expect(situation).toMatchObject({ kind: "custom", title: "Atendem em Niterói?", action: "continue", enabled: true });

      // L4: a broker answers an uncovered question after it was asked: the answer is attached to it.
      const [lead] = await tx.select({ id: s.leads.id, phone: s.leads.telefone }).from(s.leads).where(eq(s.leads.tenantId, tenantId)).limit(1);
      expect(lead).toBeTruthy();
      await recordLearningEvent({ tenantId, leadId: lead!.id, question: "aceitam pet no plano?" });
      const askedAt = new Date(Date.now() - 20 * 60 * 1000);
      await tx.update(s.situationLearningEvents).set({ createdAt: askedAt, clusteredAt: new Date() })
        .where(and(eq(s.situationLearningEvents.tenantId, tenantId), eq(s.situationLearningEvents.leadId, lead!.id)));
      await tx.insert(s.whatsappMessages).values({
        id: `test_${Date.now()}`, tenantId, leadId: lead!.id, phone: lead!.phone, direction: "outgoing", senderRole: "agent",
        provider: "meta_cloud", body: "Oi! Plano de saúde é só para pessoas, mas te passo opções de plano pet também.", sentAt: new Date(askedAt.getTime() + 5 * 60 * 1000),
      });
      const third = await runSituationLearningJob();
      expect(third.brokerAnswers).toBeGreaterThanOrEqual(1);
      const [answered] = await tx.select().from(s.situationLearningEvents).where(and(eq(s.situationLearningEvents.tenantId, tenantId), eq(s.situationLearningEvents.leadId, lead!.id)));
      expect(answered!.brokerAnswer).toBe("Oi! Plano de saúde é só para pessoas, mas te passo opções de plano pet também.");

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 90_000);
});
