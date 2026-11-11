/**
 * Relatório do modo sombra da prioridade por tipo de plantão. SOMENTE LEITURA
 * (transação read only): lê o `plantaoPriority` gravado nos offer_sent e mostra,
 * por tipo de plantão, a fatia de hoje (baseline) vs a ponderada e o % que mudaria.
 *
 * Uso: npx tsx scripts/plantao-priority-shadow-report.ts --tenant-id <id> [--days 14] [--temps hot,warm] [--json]
 */
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import { readPlantaoPriorityShadowRow, summarizePlantaoPriorityShadow } from "../src/features/lead-distribution/plantao-priority-report-core";

loadEnvConfig(process.cwd());

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
  const tenantId = argument("tenant-id");
  if (!tenantId) throw new Error("Use --tenant-id <id> [--days 14] [--temps hot,warm] [--json].");
  const days = Math.min(90, Math.max(1, Number.parseInt(argument("days") ?? "14", 10) || 14));
  const temps = (argument("temps") ?? "hot,warm").split(",").map((item) => item.trim()).filter(Boolean);
  const url = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL ou SUPABASE_DB_URL não configurado.");

  const db = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
  try {
    const result = await db.begin("read only", async (tx) => {
      const events = await tx<{ metadata: unknown; temperature: string | null }[]>`
        select event.metadata, lead.qualification_status as temperature
        from lead_distribution_events event
        inner join leads lead on lead.id = event.lead_id and lead.tenant_id = event.tenant_id
        where event.tenant_id = ${tenantId}
          and event.action = 'offer_sent'
          and event.created_at >= now() - make_interval(days => ${days})
          and event.metadata ? 'plantaoPriority'
      `;
      const types = await tx<{ id: string; name: string }[]>`select id, name from duty_schedule_types where tenant_id = ${tenantId}`;
      return { events, types };
    });
    // A temperatura gravada na hora da escolha vale mais que a atual do lead.
    const rows = result.events.flatMap((event) => {
      const row = readPlantaoPriorityShadowRow(event.metadata);
      if (!row) return [];
      const temperature = row.temperature ?? event.temperature;
      return !temps.length || (temperature !== null && temps.includes(temperature)) ? [row] : [];
    });
    const summary = summarizePlantaoPriorityShadow(rows);
    const nameOf = new Map(result.types.map((type) => [type.id, type.name]));
    const named = { ...summary, days, temps, types: summary.types.map((type) => ({ ...type, name: nameOf.get(type.typeId) ?? type.typeId })) };
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(named, null, 2));
      return;
    }
    console.log(`Prioridade por tipo de plantão (sombra), últimos ${days} dias, leads ${temps.join("/") || "todos"}`);
    console.log(`Ofertas com registro: ${summary.total}; mudariam de plantão: ${summary.changed} (${summary.changedPct}%)`);
    console.table(named.types.map((type) => ({
      tipo: type.name,
      hoje: type.baseline,
      ponderado: type.weighted,
      "fatia hoje %": type.baselineSharePct,
      "fatia ponderada %": type.weightedSharePct,
      "Δ pontos": type.deltaPoints,
      "Δ volume %": type.deltaRelativePct,
    })));
    console.log("Critério para ligar (decisão 10/11): Premium +3 a +5 pontos e nenhum plantão com Δ volume abaixo de −15%.");
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao gerar o relatório.");
  process.exitCode = 1;
});
