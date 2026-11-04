import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";
import { getSystemSetting } from "@/features/system-settings/queries";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

import { STAGE_ACTIONS, type CustomerWaitingStage } from "./domain";
import { customerWaitingSettingKey, customerWaitingSinceKey, parseCustomerWaitingMode } from "./flag";
import { loadCustomerWaitingLeads } from "./queries";

export const CUSTOMER_WAITING_OBSERVED_ACTION = "lead.customer_waiting.observed";
const LOOKBACK_DAYS = 7;
const REACHED: Array<Exclude<CustomerWaitingStage, "watching">> = ["acknowledge", "second_charge", "reassign"];

export type CustomerWaitingSweepResult = { tenants: number; waiting: number; observed: number; skipped?: "lease" };

function reachedStages(stage: CustomerWaitingStage) {
  const index = REACHED.indexOf(stage as Exclude<CustomerWaitingStage, "watching">);
  return index < 0 ? [] : REACHED.slice(0, index + 1);
}

/**
 * F1, modo observação: para cada empresa com a chave em "observe", registra uma vez por ciclo e por etapa o que o
 * sistema faria (IA acolhe e 1ª cobrança, 2ª cobrança e gestão, troca de corretor). Não envia mensagem, não
 * notifica e não mexe no lead. Só conta ciclos cujo relógio começou depois de a observação ser ligada, para não
 * registrar de uma vez o acumulado.
 */
export async function runCustomerWaitingSweep(now = new Date()): Promise<CustomerWaitingSweepResult> {
  const leased = await withJobLease("customer-waiting", 4 * 60_000, () => observeAllTenants(now));
  return leased.acquired ? leased.value : { tenants: 0, waiting: 0, observed: 0, skipped: "lease" };
}

async function observeAllTenants(now: Date): Promise<CustomerWaitingSweepResult> {
  const db = getDatabase();
  const tenants = await db.select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.status, "active"));
  const result: CustomerWaitingSweepResult = { tenants: 0, waiting: 0, observed: 0 };

  for (const tenant of tenants) {
    const mode = parseCustomerWaitingMode(await getSystemSetting(customerWaitingSettingKey(tenant.id)).catch(() => null));
    if (mode !== "observe") continue;
    result.tenants += 1;
    const sinceValue = await getSystemSetting(customerWaitingSinceKey(tenant.id)).catch(() => null);
    const since = sinceValue && Number.isFinite(Date.parse(sinceValue)) ? new Date(sinceValue) : now;

    const leads = (await loadCustomerWaitingLeads({ tenantId: tenant.id, now, lookbackDays: LOOKBACK_DAYS }))
      .filter((lead) => new Date(lead.assessment.clockStartedAt) >= since);
    result.waiting += leads.length;
    const due = leads.filter((lead) => lead.assessment.stage !== "watching");
    if (!due.length) continue;

    const logged = await db.select({ leadId: schema.auditLogs.entidadeId, metadata: schema.auditLogs.metadata })
      .from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entidade, "lead"),
        eq(schema.auditLogs.acao, CUSTOMER_WAITING_OBSERVED_ACTION),
        inArray(schema.auditLogs.entidadeId, due.map((lead) => lead.leadId)),
        gte(schema.auditLogs.createdAt, new Date(now.getTime() - (LOOKBACK_DAYS + 1) * 24 * 60 * 60 * 1000)),
      ));
    const seen = new Set(logged.map((row) => `${row.leadId}|${String(row.metadata?.cycleStartedAt ?? "")}|${String(row.metadata?.stage ?? "")}`));
    const actorId = await resolveSystemUserId(tenant.id);

    const rows = due.flatMap((lead) => reachedStages(lead.assessment.stage)
      .filter((stage) => !seen.has(`${lead.leadId}|${lead.assessment.cycleStartedAt}|${stage}`))
      .map((stage) => ({
        id: randomUUID(),
        userId: actorId,
        entidade: "lead",
        entidadeId: lead.leadId,
        acao: CUSTOMER_WAITING_OBSERVED_ACTION,
        metadata: {
          mode: "observe",
          stage,
          wouldDo: STAGE_ACTIONS[stage],
          brokerId: lead.brokerId,
          branchId: lead.branchId,
          cycleStartedAt: lead.assessment.cycleStartedAt,
          clockStartedAt: lead.assessment.clockStartedAt,
          waitingBusinessMinutes: lead.assessment.waitingBusinessMinutes,
          unansweredCount: lead.assessment.unansweredCount,
          urgent: lead.assessment.urgent,
          customerQuote: lead.assessment.customerQuote,
          metaWindowOpen: lead.assessment.metaWindowOpen,
        },
        createdAt: now,
      })));
    if (rows.length) await db.insert(schema.auditLogs).values(rows);
    result.observed += rows.length;
  }
  return result;
}
