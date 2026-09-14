/**
 * One-off: desconecta sessões WAHA órfãs pelo nome (as linhas do banco já
 * foram zeradas por scripts/reset-waha-connections.ts).
 *
 * Uso: npx tsx scripts/disconnect-orphaned-waha-sessions.ts sess1 sess2 ...
 */
import { loadEnvConfig } from "@next/env";

if (!process.env.VPS_INTERNAL_API_TOKEN?.trim()) {
  loadEnvConfig(process.cwd());
}

async function main() {
  const sessions = process.argv.slice(2);
  if (sessions.length === 0) {
    console.error("Informe os nomes das sessões como argumentos.");
    process.exit(1);
  }

  const base = (process.env.VPS_API_URL || "").trim().replace(/\/$/, "");
  const token = (process.env.VPS_INTERNAL_API_TOKEN || process.env.WHATSAPP_API_INTERNAL_TOKEN || "").trim();
  if (!base || !token) {
    console.error("VPS_API_URL e VPS_INTERNAL_API_TOKEN são obrigatórias.");
    process.exit(1);
  }

  for (const session of sessions) {
    const url = `${base}/internal/waha/connections/${encodeURIComponent(session)}/disconnect`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(22_000),
      });
      const body = await response.text();
      console.log(`[${session}] HTTP ${response.status}: ${body.slice(0, 200)}`);
    } catch (error) {
      const cause =
        error instanceof Error && error.cause
          ? ` | cause: ${JSON.stringify(error.cause).slice(0, 300)}`
          : "";
      console.error(`[${session}] FALHA: ${error instanceof Error ? error.message : String(error)}${cause}`);
    }
  }
}

void main();
