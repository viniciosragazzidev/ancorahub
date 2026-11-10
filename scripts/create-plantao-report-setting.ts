import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import { DEFAULT_PLANTAO_REPORT_CONFIG } from "../src/features/reports/plantao-report-core";

loadEnvConfig(process.cwd());

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
  const tenantId = argument("tenant-id");
  const actorUserId = argument("actor-user-id");
  if (!tenantId || !actorUserId) throw new Error("Use --tenant-id <id> --actor-user-id <id>. O usuário precisa ser diretor ativo do tenant.");
  const url = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL ou SUPABASE_DB_URL não configurado.");

  const setting = { ...DEFAULT_PLANTAO_REPORT_CONFIG, enabled: true };
  const key = `plantao_report_${tenantId}`;
  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", key, tenantId, actorUserId, setting }, null, 2));
    console.log("Revise o tenant e rode novamente com --apply para gravar e auditar a configuração.");
    return;
  }

  const db = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
  try {
    await db.begin(async (tx) => {
      const [tenant] = await tx<{ id: string }[]>`select id from tenants where id = ${tenantId} and status = 'active' limit 1`;
      if (!tenant) throw new Error("Empresa ativa não encontrada para o tenant informado.");
      const [director] = await tx<{ id: string }[]>`
        select membership.user_id as id
        from tenant_memberships membership
        inner join "user" account on account.id = membership.user_id and account.active = true
        where membership.tenant_id = ${tenantId} and membership.user_id = ${actorUserId}
          and membership.role = 'director' and membership.status = 'active'
        limit 1
      `;
      if (!director) throw new Error("O usuário informado não é diretor ativo desta empresa.");
      const [number] = await tx<{ id: string }[]>`
        select id from waha_numbers
        where id = ${setting.wahaNumberId}
          and (tenant_id is null or tenant_id = ${tenantId})
          and status in ('active', 'WORKING', 'ready', 'CONNECTED')
        limit 1
      `;
      if (!number) throw new Error("O número WAHA padrão não está ativo para esta empresa.");

      await tx`
        insert into system_settings (key, value, updated_at)
        values (${key}, ${JSON.stringify(setting)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `;
      await tx`
        insert into audit_logs (id, user_id, entidade, entidade_id, acao, metadata, created_at)
        values (${randomUUID()}, ${actorUserId}, 'plantao_report', ${tenantId}, 'plantao_report.configured', ${JSON.stringify({ source: "operator_script", groupName: setting.groupName, wahaNumberId: setting.wahaNumberId })}::jsonb, now())
      `;
    });
    console.log(`Configuração ativada e auditada para o tenant ${tenantId}.`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao configurar o relatório.");
  process.exitCode = 1;
});
