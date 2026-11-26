import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";

import { getLeadJourneySource } from "@/features/lead-journey/queries";
import { getTurboSettings, readTurboState, writeTurboState } from "@/features/qualification-turbo/service";
import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import { CADENCE } from "@/features/qualification-turbo/cadence";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { RECOVERY_STEPS } from "./cadence-rules";
import { describeRecoveryPosition, recoveryActionScopeFor, segmentForJourney, type RecoveryPosition, type RecoveryPositionTouch } from "./position-core";
import { getRecoverySettings } from "./settings";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

/** Escopo de quem age na recuperação: diretor na empresa, gestor na unidade, supervisor na equipe (ou sem corretor). */
export function recoveryLeadScope(context: Pick<TenantContext, "tenantId" | "role" | "userId" | "branchId">): SQL {
  const tenant = eq(schema.leads.tenantId, context.tenantId);
  switch (recoveryActionScopeFor(context.role)) {
    case "tenant":
      return tenant;
    case "branch":
      return context.branchId ? and(tenant, eq(schema.leads.branchId, context.branchId))! : sql`false`;
    case "team":
      return and(tenant, or(isNull(schema.leads.corretorId), inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId)))!;
    default:
      return and(tenant, isNull(schema.leads.corretorId))!;
  }
}

export async function leadInRecoveryScope(context: Pick<TenantContext, "tenantId" | "role" | "userId" | "branchId">, leadId: string) {
  const [row] = await getDatabase().select({ id: schema.leads.id }).from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt), recoveryLeadScope(context))).limit(1);
  return Boolean(row);
}

async function stoppedMidwayStart(tenantId: string, leadId: string) {
  const result = await getDatabase().execute(sql`
    select max(o.sent_at) as start_at from whatsapp_messages o
    where o.tenant_id = ${tenantId} and o.lead_id = ${leadId} and o.direction = 'outbound' and o.sender_role = 'assistant'
      and o.id not like 'recovery\\_%' and o.id not like 'ai\\_silence\\_followup\\_%'
  `);
  return rowsOf<{ start_at: string | Date | null }>(result)[0]?.start_at ?? null;
}

async function recoveryTouchesOf(tenantId: string, leadId: string): Promise<RecoveryPositionTouch[]> {
  // Sem a migration 0234 a tabela não existe: o lead só não tem passos registrados.
  return getDatabase().select({ step: schema.leadRecoveryTouches.step, status: schema.leadRecoveryTouches.status, at: schema.leadRecoveryTouches.createdAt })
    .from(schema.leadRecoveryTouches)
    .where(and(eq(schema.leadRecoveryTouches.tenantId, tenantId), eq(schema.leadRecoveryTouches.leadId, leadId)))
    .catch(() => []);
}

export type RecoveryPositionDetail = RecoveryPosition & { recovery: Record<string, unknown> | null };

/** "Onde está agora" de um lead, com o mesmo critério das cadências. */
export async function getRecoveryPosition(tenantId: string, leadId: string, now = new Date()): Promise<RecoveryPositionDetail | null> {
  const found = await getLeadJourneySource(tenantId, leadId, now);
  if (!found) return null;
  const { source, row } = found;
  const recovery = source.recovery && typeof source.recovery === "object" ? (source.recovery as Record<string, unknown>) : null;
  const turbo = readTurboState({ turbo: source.turbo });
  // Pausado ou encerrado na etapa R1/R2/R3: a etapa continua mostrando de onde o lead veio.
  const segment = segmentForJourney(row.journey.code);
  let startAt: Date | string | null = null;
  let touches: RecoveryPositionTouch[] = [];
  let running = false;
  if (segment === "never_replied") {
    startAt = turbo?.firstContactAt ?? null;
    touches = (turbo?.touches ?? []).filter((touch) => touch.touch !== "t0" && touch.touch !== "reactivation").map((touch) => ({ step: touch.touch, status: touch.status ?? "sent", at: touch.at }));
    const settings = await getTurboSettings(tenantId).catch(() => null);
    running = Boolean(settings?.enabled && settings.cadence);
  } else if (segment) {
    const [start, recorded, settings] = await Promise.all([
      segment === "stopped_midway" ? stoppedMidwayStart(tenantId, leadId) : Promise.resolve(source.assigned_at),
      recoveryTouchesOf(tenantId, leadId),
      getRecoverySettings(tenantId).catch(() => null),
    ]);
    startAt = start;
    touches = recorded;
    running = Boolean(settings?.enabled && settings.legalReviewedAt && (segment === "stopped_midway" ? settings.stoppedMidway : settings.warmBridge));
  }
  const position = describeRecoveryPosition({ now, segment, startAt, touches, recovery, turboStoppedAt: turbo?.stoppedAt ?? null, running });
  return { ...position, recovery };
}

function recoveryMerge(patch: Record<string, unknown>, remove: readonly string[] = []) {
  const base = sql`coalesce(${schema.leads.qualificationDetails}->'recovery', '{}'::jsonb)`;
  const trimmed = remove.reduce<SQL>((acc, key) => sql`(${acc} - ${key}::text)`, base);
  return sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', ${trimmed} || ${JSON.stringify(patch)}::jsonb)`;
}

async function audit(userId: string, leadId: string, acao: string, now: Date) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "lead", entidadeId: leadId, acao, createdAt: now }).catch(() => undefined);
}

export class RecoveryActionError extends Error {}

/** Pausar: a cadência deixa de escolher o lead (a marca "paused" tira ele das buscas). Não manda nada. */
export async function pauseRecovery(tenantId: string, leadId: string, userId: string, now = new Date()) {
  const position = await getRecoveryPosition(tenantId, leadId, now);
  if (!position?.canPause) throw new RecoveryActionError("Este lead não está numa recuperação que dê para pausar.");
  const updated = await getDatabase().update(schema.leads)
    .set({ qualificationDetails: recoveryMerge({ state: "paused", at: now.toISOString(), pausedAt: now.toISOString(), pausedBy: userId }) })
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), sql`${schema.leads.qualificationDetails}->'recovery'->>'state' is null`))
    .returning({ id: schema.leads.id });
  if (!updated.length) throw new RecoveryActionError("O lead mudou de etapa agora. Abra de novo para ver onde está.");
  await audit(userId, leadId, `recovery.paused:${position.next?.step ?? "sem_passo"}`, now);
}

/** Retomar: tira a pausa e a cadência volta a considerar o lead na próxima rodada. */
export async function resumeRecovery(tenantId: string, leadId: string, userId: string, now = new Date()) {
  const updated = await getDatabase().update(schema.leads)
    .set({ qualificationDetails: recoveryMerge({ resumedAt: now.toISOString(), resumedBy: userId }, ["state", "at", "pausedAt", "pausedBy"]) })
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), sql`${schema.leads.qualificationDetails}->'recovery'->>'state' = 'paused'`))
    .returning({ id: schema.leads.id });
  if (!updated.length) throw new RecoveryActionError("A recuperação deste lead não está pausada.");
  await audit(userId, leadId, "recovery.resumed", now);
}

/**
 * Pular passo: registra o próximo passo como pulado (motivo "manual_skip"), do mesmo jeito que a cadência registra
 * um passo que perdeu a hora. O seguinte assume. Não manda nada.
 */
export async function skipRecoveryStep(tenantId: string, leadId: string, userId: string, now = new Date()) {
  const position = await getRecoveryPosition(tenantId, leadId, now);
  const next = position?.next;
  if (!position?.canSkip || !next || !position.segment) throw new RecoveryActionError("Não há passo para pular agora.");
  const db = getDatabase();
  if (position.segment === "never_replied") {
    const found = await getLeadJourneySource(tenantId, leadId, now);
    const turbo = readTurboState({ turbo: found?.source.turbo });
    if (!turbo) throw new RecoveryActionError("Não há passo para pular agora.");
    const template = CADENCE.find((step) => step.touch === next.step)?.template ?? null;
    await writeTurboState(tenantId, leadId, { ...turbo, touches: [...turbo.touches, { touch: next.step as (typeof CADENCE)[number]["touch"], template, at: now.toISOString(), status: "skipped", errorCode: "manual_skip" }] });
    const attempt = turbo.touches.filter((touch) => touch.touch === next.step).length + 1;
    await db.insert(schema.leadRecoveryTouches).values({ id: randomUUID(), tenantId, leadId, segment: "never_replied", step: next.step, attempt, channel: null, template, status: "skipped", reason: "manual_skip", controlGroup: false })
      .onConflictDoNothing().catch(() => undefined);
  } else {
    const template = RECOVERY_STEPS.find((step) => step.id === next.step)?.template ?? null;
    const existing = await recoveryTouchesOf(tenantId, leadId);
    const attempt = existing.filter((touch) => touch.step === next.step).length + 1;
    try {
      const inserted = await db.insert(schema.leadRecoveryTouches).values({ id: randomUUID(), tenantId, leadId, segment: position.segment, step: next.step, attempt, channel: null, template, status: "skipped", reason: "manual_skip", controlGroup: false })
        .onConflictDoNothing().returning({ id: schema.leadRecoveryTouches.id });
      if (!inserted.length) throw new RecoveryActionError("Esse passo acabou de ser registrado. Abra de novo para ver onde está.");
    } catch (error) {
      if (error instanceof RecoveryActionError) throw error;
      throw new RecoveryActionError("A recuperação ainda não registra passos nesta empresa.");
    }
  }
  await audit(userId, leadId, `recovery.step_skipped:${next.step}`, now);
  return next.step;
}

/** Encerrar: a cadência não volta mais para este lead (a IA continua respondendo se ele escrever). */
export async function finishRecovery(tenantId: string, leadId: string, userId: string, now = new Date()) {
  const position = await getRecoveryPosition(tenantId, leadId, now);
  if (!position?.canFinish) throw new RecoveryActionError("Este lead não está numa recuperação aberta.");
  const updated = await getDatabase().update(schema.leads)
    .set({ qualificationDetails: recoveryMerge({ cadenceFinishedAt: now.toISOString(), finishedBy: userId, reason: "manual" }, position.state === "paused" ? ["state", "at", "pausedAt", "pausedBy"] : []) })
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), sql`coalesce(${schema.leads.qualificationDetails}->'recovery'->>'state', 'paused') = 'paused'`))
    .returning({ id: schema.leads.id, qualificationDetails: schema.leads.qualificationDetails });
  if (!updated.length) throw new RecoveryActionError("O lead mudou de etapa agora. Abra de novo para ver onde está.");
  const turbo = readTurboState(updated[0].qualificationDetails);
  if (turbo && !turbo.stoppedAt) await writeTurboState(tenantId, leadId, { ...turbo, stoppedAt: now.toISOString(), stopReason: "manual" });
  await audit(userId, leadId, `recovery.finished:${position.segment ?? "sem_segmento"}`, now);
}
