"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, gte, lt, sql, sum } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { journeyDay, journeyWeek } from "@/features/engagement/journey-periods";
import { journeyUserIdSchema } from "@/features/engagement/journey-validation";
import { journeyRankingTag } from "@/features/engagement/journey-cache";
import { canGrantRecognition } from "./journey-policies";
import type { JourneyActionResponse, JourneyRecognitionReceipt, RecognizeBrokerInput } from "./director-types";
import { resolveJourneyManagementScope } from "./director-access";

const inputSchema = z.object({ brokerId: journeyUserIdSchema, points: z.number().int().min(5).max(50), reason: z.string().trim().min(3).max(200) }).strict();

export async function recognizeBrokerAction(input: RecognizeBrokerInput): Promise<JourneyActionResponse<JourneyRecognitionReceipt>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Informe o corretor, de 5 a 50 pontos e um motivo de 3 a 200 caracteres." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager" && context.role !== "supervisor") return { ok: false, message: "Seu perfil não pode reconhecer corretores." };
    if (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return { ok: false, message: "A jornada está desligada." };
    const scope = await resolveJourneyManagementScope(context);
    if (!scope || !scope.brokerIds.includes(parsed.data.brokerId)) return { ok: false, message: "Corretor fora do seu escopo." };

    const day = journeyDay(new Date());
    const week = journeyWeek(new Date());
    const key = "recognition:" + createHash("sha256").update([context.tenantId, context.userId, parsed.data.brokerId, parsed.data.points, parsed.data.reason, week.periodKey].join("|")).digest("hex");
    const now = new Date();
    const result = await getDatabase().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"journey-recognition:" + context.tenantId + ":" + context.userId + ":" + week.periodKey}))`);
      const [target] = await tx.select({ userId: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId, supervisorId: schema.tenantMemberships.supervisorId, role: schema.tenantMemberships.role })
        .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, parsed.data.brokerId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true))).limit(1).for("update");
      if (!target || (context.role === "manager" && (!target.branchId || !scope.branchIds.includes(target.branchId))) ||
        (context.role === "supervisor" && (target.supervisorId !== context.userId || !context.supervisorTeamScope))) return { ok: false, message: "Corretor fora do seu escopo ativo." } as const;
      const [existing] = await tx.select({ id: schema.engagementPointEvents.id }).from(schema.engagementPointEvents)
        .where(and(eq(schema.engagementPointEvents.tenantId, context.tenantId), eq(schema.engagementPointEvents.idempotencyKey, key))).limit(1);
      // Weekly cap per sender. Reversed recognitions still count on purpose (conservative: a reversal
      // does not give the budget back, so the cap cannot be gamed by granting and reversing).
      const [budget] = await tx.select({ points: sum(schema.engagementPointEvents.points) }).from(schema.engagementPointEvents)
        .where(and(eq(schema.engagementPointEvents.tenantId, context.tenantId), eq(schema.engagementPointEvents.ruleKey, "recognition.bonus"),
          gte(schema.engagementPointEvents.periodDay, week.startsAt), lt(schema.engagementPointEvents.periodDay, week.endsAt),
          sql`${schema.engagementPointEvents.metadata}->>'senderId' = ${context.userId}`));
      const alreadyUsed = Number(budget?.points ?? 0);
      if (!existing && !canGrantRecognition(alreadyUsed, parsed.data.points)) return { ok: false, message: "O limite é 100 pontos por semana." } as const;
      const eventId = existing?.id ?? randomUUID();
      if (!existing) {
        await tx.insert(schema.engagementPointEvents).values({
          id: eventId, tenantId: context.tenantId, brokerId: target.userId, ruleKey: "recognition.bonus", points: parsed.data.points,
          entityType: "recognition", entityId: context.userId, idempotencyKey: key, occurredAt: now, periodDay: day,
          metadata: { senderId: context.userId, senderRole: context.role, reason: parsed.data.reason },
        }).onConflictDoNothing();
        await tx.insert(schema.engagementCelebrations).values({
          id: randomUUID(), tenantId: context.tenantId, userId: target.userId, kind: "points",
          payload: { kind: "points", points: parsed.data.points, ruleKey: "recognition.bonus", label: "Reconhecimento", detail: parsed.data.reason },
          idempotencyKey: "points:" + key, priority: 25, createdAt: now,
        }).onConflictDoNothing();
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "engagement_point_event", entidadeId: eventId, acao: "recognition.granted", createdAt: now });
      }
      return { ok: true, data: { eventId, brokerId: target.userId, points: parsed.data.points, remainingWeeklyPoints: Math.max(0, 100 - alreadyUsed - (existing ? 0 : parsed.data.points)), replayed: Boolean(existing) } } as const;
    });
    if (result.ok) updateTag(journeyRankingTag(context.tenantId));
    return result;
  } catch {
    return { ok: false, message: "Não foi possível registrar o reconhecimento agora." };
  }
}
