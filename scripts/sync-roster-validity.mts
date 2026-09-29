/**
 * One-off: aligns each active weekly roster row (duty_roster_assignments with
 * no duty_date) with its plantão's validity. Before the fix in
 * updateDutyScheduleAction, editing a plantão's dates left its roster with the
 * old period (e.g. "PME 24/09" shortened to one week kept its brokers until
 * 22/11), which caused false "horário sobreposto" errors.
 *
 * Dry run by default; pass --apply to write.
 *   npx tsx scripts/sync-roster-validity.mts
 *   npx tsx scripts/sync-roster-validity.mts --apply
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const sql = postgres(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "", { prepare: false, max: 1, connect_timeout: 15 });

const mismatched = await sql`
  select a.id, u.name as broker, s.name as plantao, a.valid_from as a_from, a.valid_until as a_until, s.valid_from as s_from, s.valid_until as s_until
  from duty_roster_assignments a
  join unit_duty_schedules s on s.id = a.schedule_id
  join "user" u on u.id = a.broker_id
  where a.status = 'active' and a.duty_date is null
    and (a.valid_from <> s.valid_from or a.valid_until is distinct from s.valid_until)
  order by s.name, u.name`;

const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "sem fim");
console.table(mismatched.map((row) => ({ plantao: row.plantao, corretor: row.broker, escala: `${day(row.a_from)} → ${day(row.a_until)}`, plantao_vigencia: `${day(row.s_from)} → ${day(row.s_until)}` })));
console.log(`${mismatched.length} escala(s) com vigência diferente do plantão.`);

if (apply && mismatched.length) {
  const updated = await sql`
    update duty_roster_assignments a
    set valid_from = s.valid_from, valid_until = s.valid_until, updated_at = now()
    from unit_duty_schedules s
    where s.id = a.schedule_id and a.status = 'active' and a.duty_date is null
      and (a.valid_from <> s.valid_from or a.valid_until is distinct from s.valid_until)
    returning a.id`;
  console.log(`${updated.length} escala(s) alinhada(s) com o plantão.`);
} else if (!apply) {
  console.log("Simulação: nada foi gravado. Rode com --apply para alinhar.");
}
await sql.end();
