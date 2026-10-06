/*
 * Teste SOMENTE LEITURA das conexões do banco, para rodar DENTRO do container do CRM:
 *
 *   sudo docker exec -i "$APP" node - < db-pool-probe.cjs
 *
 * Compara a conexão atual (SUPABASE_DB_URL, session pooler 5432) com a do transaction
 * pooler (DATABASE_URL, 6543) usando as mesmas opções do app (postgres.js, prepare:false)
 * e as mesmas consultas do login (sessão + usuário + vínculo com a empresa), sob carga.
 * Nunca escreve nada: só SELECT e uma transação READ ONLY que termina em ROLLBACK.
 * Nenhuma senha é impressa.
 */
const postgres = require("postgres");

const STEP_TIMEOUT_MS = 12_000;
const PARALLEL = 30;

function withTimeout(promise, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`TIMEOUT ${STEP_TIMEOUT_MS}ms em ${label}`)), STEP_TIMEOUT_MS); }),
  ]).finally(() => clearTimeout(timer));
}

function describe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}${u.pathname}${u.search}`;
  } catch {
    return "URL inválida";
  }
}

function cleanUrl(url) {
  // Remove "&sslmode=..." colado no nome do banco (formato inválido) e qualquer query string.
  return url.replace(/&sslmode=[^/?#]*/i, "").replace(/\?.*$/, "");
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

async function probe(name, url, max, extra = {}) {
  const out = { cenario: name, destino: describe(url), pool: max };
  if (!url) return { ...out, resultado: "SEM URL" };
  const sql = postgres(url, { max, prepare: false, connect_timeout: 10, idle_timeout: 5, onnotice: () => {}, ...extra });
  if (Object.keys(extra).length) out.opcoes = extra;
  const t = async (label, fn) => {
    const start = Date.now();
    await withTimeout(fn(), label);
    return Date.now() - start;
  };
  try {
    out.select1_ms = await t("SELECT 1", () => sql`select 1 as ok`);
    out.login_ms = await t("consulta do login", () => sql`
      select s.id, u.id as user_id, m.tenant_id
      from session s
      join "user" u on u.id = s.user_id
      left join tenant_memberships m on m.user_id = u.id
      where s.expires_at > now()
      order by s.expires_at desc
      limit 5`);
    out.transacao_readonly_ms = await t("transação read only", () => sql.begin("read only", async (tx) => {
      await tx`select count(*) from session where expires_at > now()`;
      await tx`select 1`;
    }));
    const times = [];
    const start = Date.now();
    await withTimeout(Promise.all(Array.from({ length: PARALLEL }, async () => {
      const s = Date.now();
      await sql`select s.id from session s join "user" u on u.id = s.user_id where s.expires_at > now() limit 1`;
      times.push(Date.now() - s);
    })), `${PARALLEL} logins em paralelo`);
    out[`${PARALLEL}_em_paralelo_total_ms`] = Date.now() - start;
    out.paralelo_p50_ms = percentile(times, 50);
    out.paralelo_p95_ms = percentile(times, 95);
    out.resultado = "OK";
  } catch (error) {
    out.resultado = "FALHOU";
    out.erro = String(error && (error.code ? `${error.code}: ` : "") + (error.message || error)).slice(0, 220);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
  return out;
}

(async () => {
  const current = process.env.SUPABASE_DB_URL || "";
  const transaction = process.env.DATABASE_URL || "";
  const cleaned = cleanUrl(transaction);
  const results = [];
  results.push(await probe("A · atual (SUPABASE_DB_URL), pool 2", current, 2));
  results.push(await probe("B · 6543 limpa (sem sslmode), pool 10", cleaned, 10));
  if (!process.env.SO_NOVOS) results.push(await probe("C · 6543 com ?sslmode=require, pool 10", cleaned ? `${cleaned}?sslmode=require` : "", 10));
  results.push(await probe("D · 6543 limpa, pool 10, sem pipelining", cleaned, 10, { max_pipeline: 1 }));
  results.push(await probe("E · 5432 atual, pool 5", current, 5));
  for (const r of results) console.log(JSON.stringify(r));
  console.log("FIM: compare login_ms e paralelo_p95_ms; FALHOU/TIMEOUT indica o que derrubou o login.");
})();
