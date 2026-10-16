import "server-only";

import { and, eq } from "drizzle-orm";

import { loadDutyNow, type DutyNow } from "@/features/broker-workspace/duty-now";
import { addCalendarDays, buildDutySummary, loadBrokerDutyRows } from "@/features/broker-workspace/duty-summary";
import type { BrokerActiveDuty } from "@/features/broker-workspace/queries";
import { getSaoPauloDateKey } from "@/features/lead-distribution/dated-duty-roster";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/**
 * Pode o viewer ver o plantão deste corretor? Diretor: todos. Gestor: corretores da própria unidade.
 * Supervisor: corretores da própria equipe (supervisor do corretor = o viewer, na mesma unidade).
 */
async function viewerCanSeeBroker(input: { tenantId: string; viewerId: string; role: string; branchId: string | null; supervisorTeamScope: boolean | undefined; brokerId: string }) {
  if (input.role === "director") {
    // The director sees any broker of the tenant.
  } else if (input.role === "manager" && input.branchId) {
    // The gestor sees the brokers of his own unit only.
  } else if (input.role === "supervisor" && input.supervisorTeamScope && input.branchId) {
    // The supervisor sees the brokers of his own team only.
  } else {
    return false;
  }
  const [member] = await getDatabase().select({ branchId: schema.tenantMemberships.branchId, supervisorId: schema.tenantMemberships.supervisorId })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, input.tenantId),
      eq(schema.tenantMemberships.userId, input.brokerId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .limit(1);
  if (!member) return false;
  if (input.role === "director") return true;
  if (member.branchId !== input.branchId) return false;
  return input.role === "manager" || member.supervisorId === input.viewerId;
}

/** As duas flags que a leitura do plantão usa (escala mensal e confirmação de presença), como na tela do corretor. */
async function readDutyFlags() {
  const [monthly, presence] = await Promise.all([
    getSystemSetting(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING.key),
    getSystemSetting(FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION.key),
  ]);
  return {
    monthly: (monthly ?? FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING.defaultValue) === "true",
    presence: (presence ?? FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION.defaultValue) === "true",
  };
}

/**
 * Plantões que o corretor está agora, pela mesma leitura da tela do corretor (buildDutySummary):
 * escala mensal publicada, semanal válida, fuso do plantão. Olha ontem e hoje, para pegar o noturno
 * que começou ontem.
 */
async function dutiesRunningNow(tenantId: string, brokerId: string, now: Date): Promise<BrokerActiveDuty[]> {
  const yesterdayKey = addCalendarDays(getSaoPauloDateKey(now), -1);
  const [inputs, flags] = await Promise.all([
    loadBrokerDutyRows({ tenantId, brokerId, now, fromDateKey: yesterdayKey }),
    readDutyFlags(),
  ]);
  const summary = await buildDutySummary({
    tenantId,
    rows: inputs.rows,
    publishedRows: inputs.publishedRows,
    now,
    monthlySchedulingEnabled: flags.monthly,
    presenceRequired: flags.presence,
    availabilityStatus: "available",
    dayOffsets: [-1, 0],
  });
  return summary?.activeAll ?? [];
}

/**
 * The plantão of a broker of the viewer's scope, running now: the same screen the broker sees for himself.
 * denied: the broker is outside the viewer's scope. idle: no plantão running now.
 */
export async function getBrokerDutyNowForViewer(input: { brokerId: string; scheduleId?: string | null; now?: Date }): Promise<{ access: "denied" } | { access: "idle" } | { access: "ok"; duty: DutyNow }> {
  const context = await getRequiredTenantContext();
  const now = input.now ?? new Date();
  const allowed = await viewerCanSeeBroker({
    tenantId: context.tenantId,
    viewerId: context.userId,
    role: context.role,
    branchId: context.branchId ?? null,
    supervisorTeamScope: context.supervisorTeamScope,
    brokerId: input.brokerId,
  });
  if (!allowed) return { access: "denied" };
  const running = await dutiesRunningNow(context.tenantId, input.brokerId, now);
  const active = running.find((duty) => duty.scheduleId === input.scheduleId) ?? running[0];
  if (!active) return { access: "idle" };
  return { access: "ok", duty: await loadDutyNow({ tenantId: context.tenantId, brokerId: input.brokerId, now, running, active }) };
}
