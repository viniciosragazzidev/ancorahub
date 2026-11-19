import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { CALL_ANCORA_SOURCE } from "./cold-base";
import { periodStart, type CallAncoraCallRow, type CallAncoraReportOutcome, type ReportPeriod } from "./report-rules";
import { maskPhone, normalizeBrPhone } from "./test-list";

const OUTCOMES = new Set<CallAncoraReportOutcome>(["interested", "not_interested", "no_answer", "voicemail", "wrong_number"]);

/**
 * Ligações do Call Âncora no período (somente leitura): as notas de `lead_interactions`
 * com metadata.source = call_ancora, no tenant, com o nome do corretor e do lead.
 * Telefone sempre mascarado.
 */
export async function readCallAncoraCalls(input: { tenantId: string; period: ReportPeriod; brokerId?: string; limit?: number; now?: Date }): Promise<CallAncoraCallRow[]> {
  const since = periodStart(input.period, input.now ?? new Date());
  const rows = await getDatabase()
    .select({
      id: schema.leadInteractions.id,
      brokerId: schema.leadInteractions.userId,
      brokerName: schema.user.name,
      leadId: schema.leads.id,
      leadName: schema.leads.nome,
      phone: schema.leads.telefone,
      metadata: schema.leadInteractions.metadata,
      at: schema.leadInteractions.createdAt,
    })
    .from(schema.leadInteractions)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
    .innerJoin(schema.user, eq(schema.user.id, schema.leadInteractions.userId))
    .where(and(
      eq(schema.leads.tenantId, input.tenantId),
      input.brokerId ? eq(schema.leadInteractions.userId, input.brokerId) : undefined,
      gte(schema.leadInteractions.createdAt, since),
      sql`${schema.leadInteractions.metadata}->>'source' = ${CALL_ANCORA_SOURCE}`,
    ))
    .orderBy(desc(schema.leadInteractions.createdAt))
    .limit(input.limit ?? 2000);

  const calls: CallAncoraCallRow[] = [];
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const outcome = meta.outcome as CallAncoraReportOutcome;
    if (!OUTCOMES.has(outcome)) continue;
    const phone = normalizeBrPhone(row.phone);
    calls.push({
      id: row.id,
      brokerId: row.brokerId,
      brokerName: row.brokerName,
      leadId: row.leadId,
      leadName: row.leadName,
      phoneMasked: phone ? maskPhone(phone) : "••••",
      outcome,
      auto: meta.auto === true,
      correction: meta.correction === true,
      talkSeconds: typeof meta.talkSeconds === "number" ? meta.talkSeconds : 0,
      causeLabel: typeof meta.causeLabel === "string" ? meta.causeLabel : null,
      assigned: meta.assigned === true,
      at: row.at.toISOString(),
    });
  }
  return calls;
}
