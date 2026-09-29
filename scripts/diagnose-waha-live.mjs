#!/usr/bin/env node
/**
 * Diagnóstico ao vivo do WAHA via Fastify (Coolify).
 *
 * Uso (na raiz do repositório):
 *   node --env-file=.env.local scripts/diagnose-waha-live.mjs
 *
 * Lê VPS_API_URL e o token interno do ambiente (nunca imprime o token) e chama
 * GET /internal/waha/diagnostics da API de produção (repositório corretop-infra),
 * que devolve versão/engine do WAHA, uptime e sessões. Requer a API com a rota
 * redeployada.
 */
const base = (process.env.VPS_API_URL || "").trim().replace(/\/+$/, "");
const token = (
  process.env.WHATSAPP_API_INTERNAL_TOKEN ||
  process.env.VPS_INTERNAL_API_TOKEN ||
  process.env.VPS_API_TOKEN ||
  ""
).trim();

async function main() {
if (!base || !token) {
  console.error("Defina VPS_API_URL e o token interno (VPS_INTERNAL_API_TOKEN) no ambiente.");
  { process.exitCode = 2; return; }
}

const say = (icon, text) => console.log(`${icon}  ${text}`);

let response;
try {
  response = await fetch(`${base}/internal/waha/diagnostics`, {
    // A API de produção (repo corretop-infra) valida Authorization: Bearer com o
    // INTERNAL_API_TOKEN; o header legado cobre a cópia em services/whatsapp-api.
    headers: { authorization: `Bearer ${token}`, "x-corretop-internal-token": token },
    signal: AbortSignal.timeout(20_000),
  });
} catch (error) {
  say("❌", `Fastify inacessível em ${base}: ${error instanceof Error ? error.message : error}`);
  { process.exitCode = 1; return; }
}

if (response.status === 404) {
  say("⚠️ ", "Rota /internal/waha/diagnostics não existe: a API em produção ainda é a versão ANTIGA.");
  say("➡️ ", "Faça o redeploy da API pelo repositório corretop-infra (branch fix/waha-pairing-state) no Coolify e rode de novo.");
  { process.exitCode = 1; return; }
}
if (response.status === 401) {
  say("❌", "Token interno recusado (401): VPS_INTERNAL_API_TOKEN do CRM difere do INTERNAL_API_TOKEN da API.");
  { process.exitCode = 1; return; }
}

const data = await response.json().catch(() => null);
if (!response.ok || !data?.ok) {
  say("❌", `Resposta inesperada (${response.status}): ${JSON.stringify(data)?.slice(0, 300)}`);
  { process.exitCode = 1; return; }
}

const problems = [];

say("🩺", `WAHA health: ${data.health?.status} (${data.health?.durationMs} ms)`);
if (data.health?.status !== "healthy") problems.push("WAHA não está saudável: o QR não pode ser gerado nem lido.");

const v = data.version;
if (v) {
  say("📦", `Versão ${v.version ?? "?"} · engine ${v.engine ?? "?"} · tier ${v.tier ?? "?"}`);
} else {
  say("📦", "Versão indisponível.");
}

const uptimeMs = Number(data.server?.uptime);
if (Number.isFinite(uptimeMs)) {
  const minutes = Math.round(uptimeMs / 60_000);
  say("⏱️ ", `Uptime do WAHA: ${minutes < 120 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} h`}`);
  if (minutes < 30) problems.push("WAHA reiniciou há pouco (pode ser o próprio deploy). Se isso se repetir sem deploy, é OOM/crash: veja o log e o limite de memória do container.");
}


if (Array.isArray(data.sessions)) {
  say("👥", `Sessões no WAHA: ${data.sessions.length}`);
  for (const s of data.sessions) {
    console.log(`     • ${s.name}  ${s.status}${s.phoneSuffix ? `  (final ${s.phoneSuffix})` : ""}`);
  }
  const stuck = data.sessions.filter((s) => ["FAILED", "STOPPED"].includes(String(s.status).toUpperCase()));
  if (stuck.length) problems.push(`${stuck.length} sessão(ões) FAILED/STOPPED. Use "Gerar novo QR" no CRM para recriá-las.`);
  const pairing = data.sessions.filter((s) => ["SCAN_QR_CODE", "STARTING"].includes(String(s.status).toUpperCase()));
  const working = data.sessions.filter((s) => String(s.status).toUpperCase() === "WORKING");
  if (pairing.length >= 4) problems.push(`${pairing.length} sessões presas em SCAN_QR_CODE/STARTING (${working.length} conectadas). Cada uma mantém um Chromium (≈300–500 MB) no engine WEBJS; sessões abandonadas disputam CPU/memória com a que você está tentando parear e podem fazer o vínculo falhar. Rode scripts/_tmp-waha-session-audit.ts para separar as órfãs.`);
  else if (data.sessions.length > 8) problems.push("Muitas sessões simultâneas: cada uma mantém um Chromium (≈300–500 MB). Verifique a memória da VPS.");
}

if (data.errors?.length) say("⚠️ ", `Consultas que falharam no WAHA: ${data.errors.join(", ")}`);

console.log();
if (problems.length) {
  say("🔎", "Pontos de atenção:");
  for (const p of problems) console.log(`     - ${p}`);
} else {
  say("✅", "Nada anormal no servidor WAHA. Se o celular ainda recusa o QR, verifique Dispositivos conectados no aparelho (limite de 4) e tente novamente mais tarde (limite de tentativas do WhatsApp).");
}
}

await main();
