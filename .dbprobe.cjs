require("dotenv").config({ path: ".env.local", quiet: true });
const postgres = require("postgres");
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, connect_timeout: 10 });
(async () => {
  try {
    const act = await sql.unsafe(`
      select pid, state, usename, application_name, client_addr,
             now() - query_start as dur, wait_event_type, left(query, 100) as q
      from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
      order by query_start asc nulls last
      limit 25`);
    console.log(JSON.stringify(act, null, 1));
    const cnt = await sql.unsafe("select state, count(*)::int as n from pg_stat_activity where datname = current_database() group by state");
    console.log("SUMMARY:", JSON.stringify(cnt));
  } catch (e) { console.log("ERR: " + e.message); } finally { process.exit(0); }
})();