/**
 * Reset operacional de todas as conexões WhatsApp (WAHA) do CRM.
 *
 * Uso:
 *   npx tsx scripts/reset-waha-connections.ts          # dry-run (lista e não altera)
 *   npx tsx scripts/reset-waha-connections.ts --apply  # executa de fato
 *
 * O que faz:
 *  1. Lista todas as linhas de `whatsapp_connections`.
 *  2. Para cada sessão com `session_name`, chama
 *     POST {VPS_API_URL}/internal/waha/connections/:session/disconnect
 *     (stop + logout + delete da sessão no WAHA).
 *  3. Zera as linhas no banco (status=disconnected, sem sessão/QR).
 *
 * Env necessários (presentes em .env.local):
 *   DATABASE_URL, VPS_API_URL, VPS_INTERNAL_API_TOKEN
 */
import { readFileSync } from "node:fs";

import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/shared/db/schema";

// Mesmo padrão do scripts/migrate.ts: preserva env injetada e carrega os
// arquivos locais (.env.local etc.) quando o processo vem sem DATABASE_URL.
if (!process.env.SUPABASE_DB_URL?.trim() && !process.env.DATABASE_URL?.trim()) {
  loadEnvConfig(process.cwd());
}
// O DATABASE_URL de produção fica em .env.vercel.prod (não padrão do Next);
// como fallback final, parseia esse arquivo.
if (!process.env.DATABASE_URL?.trim()) {
  try {
    const raw = readFileSync(".env.vercel.prod", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]?.trim()) {
        process.env[match[1]] = match[2].replace(/^"|"$/g, "");
      }
    }
  } catch {
    // arquivo ausente — o erro de env obrigatória abaixo será reportado
  }
}

async function main() {
  const apply = process.argv.includes("--apply");

  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  if (!databaseUrl) {
    console.error("SUPABASE_DB_URL ou DATABASE_URL é obrigatória (env ou .env.local).");
    process.exit(1);
  }

  const vpsBase = (process.env.VPS_API_URL || "").trim().replace(/\/$/, "");
  const vpsToken = (
    process.env.VPS_INTERNAL_API_TOKEN ||
    process.env.WHATSAPP_API_INTERNAL_TOKEN ||
    ""
  ).trim();
  if (!vpsBase || !vpsToken) {
    console.error("VPS_API_URL e VPS_INTERNAL_API_TOKEN são obrigatórias.");
    process.exit(1);
  }

  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  const rows = await db
    .select({
      id: schema.whatsappConnections.id,
      tenantId: schema.whatsappConnections.tenantId,
      userId: schema.whatsappConnections.userId,
      sessionName: schema.whatsappConnections.sessionName,
      status: schema.whatsappConnections.status,
      hasQr: schema.whatsappConnections.qrCode,
    })
    .from(schema.whatsappConnections);

  console.log(`Encontradas ${rows.length} conexão(ões):`);
  for (const row of rows) {
    console.log(
      `  - tenant=${row.tenantId.slice(0, 8)} user=${row.userId?.slice(0, 8) ?? "-"} ` +
        `session=${row.sessionName ?? "-"} status=${row.status}`,
    );
  }

  if (!apply) {
    console.log("\n[DRY-RUN] Nada foi alterado. Use --apply para executar.");
    await client.end();
    return;
  }

  let disconnectOk = 0;
  let disconnectFail = 0;
  for (const row of rows) {
    if (!row.sessionName) continue;
    try {
      const response = await fetch(
        `${vpsBase}/internal/waha/connections/${encodeURIComponent(row.sessionName)}/disconnect`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${vpsToken}` },
          signal: AbortSignal.timeout(22_000),
        },
      );
      const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (response.ok && body?.ok) {
        disconnectOk += 1;
        console.log(`  [OK] sessão ${row.sessionName} desconectada no WAHA`);
      } else {
        disconnectFail += 1;
        console.warn(
          `  [FALHA] sessão ${row.sessionName}: HTTP ${response.status} ${JSON.stringify(body)?.slice(0, 200)}`,
        );
      }
    } catch (error) {
      disconnectFail += 1;
      console.warn(
        `  [FALHA] sessão ${row.sessionName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await db
    .update(schema.whatsappConnections)
    .set({
      sessionId: null,
      sessionName: null,
      status: "disconnected",
      qrCode: null,
      connectedAt: null,
      updatedAt: new Date(),
    });

  console.log(
    `\n[APPLY] Concluído. Sessões desconectadas no WAHA: ${disconnectOk}. ` +
      `Falhas: ${disconnectFail}. Linhas zeradas no banco: ${rows.length}.`,
  );
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
