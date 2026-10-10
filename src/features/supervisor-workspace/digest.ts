import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { periodDay } from "@/features/engagement/scoring";
import { formatDuration } from "@/features/engagement/ranking";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { getSupervisorWorkspaceData, type SupervisorWorkspaceData } from "./queries";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The team's day in up to 5 short lines (pure: tested without a database). */
export function buildDigestLines(data: SupervisorWorkspaceData): string[] {
  const lines = [`Hoje a equipe recebeu ${data.today.receivedToday} lead(s) e tem ${data.today.inService} em atendimento.`];
  if (data.today.late) lines.push(`${data.today.late} lead(s) seguem sem primeiro contato além do prazo.`);
  const best = [...data.team].sort((a, b) => (b.stats?.accepted ?? 0) - (a.stats?.accepted ?? 0))[0];
  if (best?.stats?.accepted) lines.push(`Destaque da semana: ${firstName(best.name)}, ${best.stats.accepted} aceites (aceita em ${formatDuration(best.stats.medianAcceptSeconds)}).`);
  const needing = data.team.filter((broker) => broker.late > 0).sort((a, b) => b.late - a.late)[0];
  if (needing) lines.push(`Converse com ${firstName(needing.name)} amanhã: ${needing.late} lead(s) atrasado(s).`);
  if (data.goal) lines.push(`Meta da equipe: ${data.goal.percentage}% (${data.goal.currentValue} de ${data.goal.targetValue}).`);
  return lines.slice(0, 5);
}

/**
 * P7: at 19h (São Paulo) every team-scoped supervisor with a team gets the day
 * in the Âncora thread. Idempotent per supervisor and day (safe to run twice).
 */
export async function runSupervisorDigest(now = new Date()) {
  if ((await getFeatureFlag(FEATURE_FLAGS.SUPERVISOR_TEAM_SCOPE).catch(() => "false")) !== "true") return { skipped: "flag_off" as const };
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour < 19) return { skipped: "before_19h" as const };

  const memberships = schema.tenantMemberships;
  // Supervisors that have at least one active broker in their team.
  const supervisors = await getDatabase().selectDistinct({ userId: memberships.userId, tenantId: memberships.tenantId, branchId: memberships.branchId, jobTitle: memberships.jobTitle })
    .from(memberships)
    .where(and(
      eq(memberships.role, "supervisor"),
      eq(memberships.status, "active"),
      isNotNull(memberships.userId),
      sql`exists (select 1 from ${memberships} t where t.tenant_id = ${memberships.tenantId} and t.supervisor_id = ${memberships.userId} and t.status = 'active')`,
    ));

  let sent = 0;
  for (const supervisor of supervisors) {
    try {
      const context: TenantContext = { userId: supervisor.userId, tenantId: supervisor.tenantId, role: "supervisor", jobTitle: supervisor.jobTitle, branchId: supervisor.branchId, supervisorTeamScope: true };
      const data = await getSupervisorWorkspaceData(context, now);
      if (!data.team.length) continue;
      const delivered = await publishNotification({
        capability: "supervisor_digest",
        tenantId: supervisor.tenantId,
        recipientUserId: supervisor.userId,
        type: "supervisor.digest",
        title: "Resumo do dia da sua equipe",
        message: buildDigestLines(data).join(" "),
        // The lock screen shows no names or numbers: the details stay inside the app.
        pushBody: "Toque para ver como foi o dia da sua equipe.",
        url: "/dashboard/c/equipe",
        tag: `supervisor-digest-${periodDay(now)}`,
        idempotencyKey: `supervisor-digest:${supervisor.userId}:${periodDay(now)}`,
      });
      if (delivered) sent += 1;
    } catch (error) {
      console.error("[supervisor-digest] failed", supervisor.userId, error instanceof Error ? error.message : "unknown_error");
    }
  }
  return { supervisors: supervisors.length, sent };
}
