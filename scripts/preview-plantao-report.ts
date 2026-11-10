import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import {
  buildPlantaoReportText,
  calculatePlantaoMetrics,
  classifyPlantaoLead,
  parsePlantaoReportConfig,
  plantaoReportDayStart,
  type PlantaoOfferRow,
  type PlantaoQueueRow,
} from "../src/features/reports/plantao-report-core";
import { shortDate } from "../src/features/reports/daily-leads-report-core";

loadEnvConfig(process.cwd());

const TENANT_ID = process.argv.find((arg) => arg.startsWith("--tenant-id="))?.slice("--tenant-id=".length)
  ?? "d47a4d41-4e45-450d-a0b8-a9e1be286903";
const DAY_09_START = new Date("2026-11-09T03:00:00.000Z");
const DAY_09_END = new Date("2026-11-10T03:00:00.000Z");
const DAY_09_LABEL_AT = new Date(DAY_09_END.getTime() - 1);

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Configure DATABASE_URL ou SUPABASE_DB_URL para gerar a prévia somente leitura.");

  const db = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false });
  try {
    const now = new Date();
    const todayFrom = plantaoReportDayStart(now);
    const todayTo = now;
    const previews = await db.begin(async (tx) => {
      await tx`set transaction read only`;
      const [setting] = await tx<{ value: string }[]>`
        select value from system_settings where key = ${`plantao_report_${TENANT_ID}`} limit 1
      `;
      const config = parsePlantaoReportConfig(setting?.value);

      const loadText = async (from: Date, until: Date, labelAt: Date) => {
        const queueRowsRaw = await tx<{ queue_name: string | null; has_form_answers: boolean; has_ctwa_clid: boolean; has_without_referral: boolean; count: number }[]>`
          with entrants as (
            select l.id,
              coalesce(l.source_metadata, '{}'::jsonb) ? 'formAnswers' as has_form_answers,
              coalesce(l.source_metadata, '{}'::jsonb) ? 'ctwaClid' as has_ctwa_clid,
              coalesce(l.source_metadata, '{}'::jsonb) ? 'withoutReferral' as has_without_referral,
              first_queue.to_queue_id
            from leads l
            left join lateral (
              select event.to_queue_id
              from lead_distribution_events event
              where event.tenant_id = l.tenant_id and event.lead_id = l.id and event.action = 'queued'
              order by event.created_at asc, event.id asc
              limit 1
            ) first_queue on true
            where l.tenant_id = ${TENANT_ID}
              and l.created_at >= ${from.toISOString()}::timestamptz
              and l.created_at < ${until.toISOString()}::timestamptz
          )
          select queue.name as queue_name, entrants.has_form_answers,
            entrants.has_ctwa_clid, entrants.has_without_referral, count(*)::int as count
          from entrants
          left join lead_queues queue on queue.id = entrants.to_queue_id and queue.tenant_id = ${TENANT_ID}
          group by queue.name, entrants.has_form_answers, entrants.has_ctwa_clid, entrants.has_without_referral
        `;
        const offersRaw = await tx<{ lead_id: string; broker_id: string; duty_schedule_id: string | null; duty_name: string | null; original_queue_name: string | null; offered_at: Date }[]>`
          select offer.lead_id, offer.broker_id, offer.duty_schedule_id,
            schedule.name as duty_name, original_queue.name as original_queue_name, offer.offered_at
          from lead_offers offer
          left join unit_duty_schedules schedule
            on schedule.id = offer.duty_schedule_id and schedule.tenant_id = offer.tenant_id
          left join lateral (
            select event.to_queue_id
            from lead_distribution_events event
            where event.tenant_id = offer.tenant_id and event.lead_id = offer.lead_id and event.action = 'queued'
            order by event.created_at asc, event.id asc
            limit 1
          ) first_queue on true
          left join lead_queues original_queue
            on original_queue.id = first_queue.to_queue_id and original_queue.tenant_id = offer.tenant_id
          where offer.tenant_id = ${TENANT_ID}
            and offer.accepted_at is not null
            and offer.offered_at >= ${from.toISOString()}::timestamptz
            and offer.offered_at < ${until.toISOString()}::timestamptz
        `;

        const queueRows: PlantaoQueueRow[] = queueRowsRaw.map((row) => ({
          queueName: row.queue_name,
          kind: classifyPlantaoLead({ hasFormAnswers: row.has_form_answers, hasCtwaClid: row.has_ctwa_clid, hasWithoutReferral: row.has_without_referral }),
          count: Number(row.count),
        }));
        const offers: PlantaoOfferRow[] = offersRaw.map((row) => ({
          leadId: row.lead_id,
          brokerId: row.broker_id,
          dutyScheduleId: row.duty_schedule_id,
          dutyName: row.duty_name,
          originalQueueName: row.original_queue_name,
          offeredAt: row.offered_at,
        }));
        return buildPlantaoReportText(calculatePlantaoMetrics(queueRows, offers, config), labelAt);
      };

      return {
        today: await loadText(todayFrom, todayTo, now),
        day09: await loadText(DAY_09_START, DAY_09_END, DAY_09_LABEL_AT),
      };
    });

    console.log(`PRÉVIA DE HOJE (${shortDate(now)}; até ${now.toISOString()})\n${previews.today}`);
    console.log(`\nPRÉVIA DE 09/11/2026 (dia inteiro)\n${previews.day09}`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao gerar a prévia somente leitura.");
  process.exitCode = 1;
});
