import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import {
  calculatePlantaoMetrics,
  classifyPlantaoLead,
  DEFAULT_PLANTAO_REPORT_CONFIG,
  type PlantaoOfferRow,
  type PlantaoQueueRow,
} from "../src/features/reports/plantao-report-core";

loadEnvConfig(process.cwd());

const TENANT_ID = process.argv.find((arg) => arg.startsWith("--tenant-id="))?.slice("--tenant-id=".length)
  ?? "d47a4d41-4e45-450d-a0b8-a9e1be286903";
const FROM = new Date("2026-11-09T03:00:00.000Z");
const UNTIL = new Date("2026-11-10T03:00:00.000Z");

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Configure DATABASE_URL ou SUPABASE_DB_URL para a conferência somente leitura.");
  const db = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false });
  try {
    const actual = await db.begin(async (tx) => {
      await tx`set transaction read only`;
      const queueRowsRaw = await tx<{ queue_name: string | null; origin: string; has_form_answers: boolean; has_ctwa_clid: boolean; has_without_referral: boolean; count: number }[]>`
        with entrants as (
          select l.id, l.origem::text as origin,
            coalesce(l.source_metadata, '{}'::jsonb) ? 'formAnswers' as has_form_answers,
            coalesce(l.source_metadata, '{}'::jsonb) ? 'ctwaClid' as has_ctwa_clid,
            coalesce(l.source_metadata, '{}'::jsonb) ? 'withoutReferral' as has_without_referral,
            first_queue.to_queue_id
          from leads l
          left join lateral (
            select event.to_queue_id from lead_distribution_events event
            where event.tenant_id = l.tenant_id and event.lead_id = l.id and event.action = 'queued'
            order by event.created_at asc, event.id asc limit 1
          ) first_queue on true
          where l.tenant_id = ${TENANT_ID} and l.created_at >= ${FROM} and l.created_at < ${UNTIL}
        )
        select queue.name as queue_name, entrants.origin, entrants.has_form_answers,
          entrants.has_ctwa_clid, entrants.has_without_referral, count(*)::int as count
        from entrants
        left join lead_queues queue on queue.id = entrants.to_queue_id and queue.tenant_id = ${TENANT_ID}
        group by queue.name, entrants.origin, entrants.has_form_answers, entrants.has_ctwa_clid, entrants.has_without_referral
      `;
      const offersRaw = await tx<{ lead_id: string; broker_id: string; duty_schedule_id: string | null; duty_name: string | null; offered_at: Date }[]>`
        select offer.lead_id, offer.broker_id, offer.duty_schedule_id,
          schedule.name as duty_name, offer.offered_at
        from lead_offers offer
        left join unit_duty_schedules schedule
          on schedule.id = offer.duty_schedule_id and schedule.tenant_id = offer.tenant_id
        where offer.tenant_id = ${TENANT_ID} and offer.accepted_at is not null
          and offer.offered_at >= ${FROM} and offer.offered_at < ${UNTIL}
      `;
      const queueRows: PlantaoQueueRow[] = queueRowsRaw.map((row) => ({
        queueName: row.queue_name,
        kind: classifyPlantaoLead({ hasFormAnswers: row.has_form_answers, hasCtwaClid: row.has_ctwa_clid, hasWithoutReferral: row.has_without_referral }),
        origin: row.origin,
        count: Number(row.count),
      }));
      const offers: PlantaoOfferRow[] = offersRaw.map((row) => ({ leadId: row.lead_id, brokerId: row.broker_id, dutyScheduleId: row.duty_schedule_id, dutyName: row.duty_name, offeredAt: row.offered_at }));
      return calculatePlantaoMetrics(queueRows, offers, DEFAULT_PLANTAO_REPORT_CONFIG);
    });

    const expected = {
      external: { whatsapp: 92, rd: 27, total: 119 },
      internal: { facebook: 118, whatsapp: 17, total: 135 },
      indications: { morning: 86, afternoon: 48 },
      quantity: { pme: 9.5, onlineMorning: 4.2, onlineAfternoon: 1, inPersonMorning: 6.5, inPersonAfternoon: 6.7 },
    };
    const actualRounded = { ...actual, quantity: Object.fromEntries(Object.entries(actual.quantity).map(([key, value]) => [key, Number(value.toFixed(1))])) };
    console.log(JSON.stringify({ mode: "READ ONLY", tenantId: TENANT_ID, from: FROM.toISOString(), until: UNTIL.toISOString(), expected, actual: actualRounded }, null, 2));
    if (JSON.stringify(actualRounded) !== JSON.stringify(expected)) process.exitCode = 2;
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha na conferência de leitura.");
  process.exitCode = 1;
});
