/**
 * Configura a prioridade por tipo de plantão de uma empresa (system_settings
 * plantao_priority_<tenant>) e, opcionalmente, liga a flag global. Sem --apply só
 * mostra o que gravaria (dry-run). Com --apply grava e registra em audit_logs.
 *
 * Uso:
 *   npx tsx scripts/set-plantao-priority-setting.ts --tenant-id <id> --actor-user-id <diretor> \
 *     --mode shadow --type-id <tipo Premium> --base 1.15 [--enable-flag] [--apply]
 */
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import { normalizePlantaoPrioritySettings, PLANTAO_WEIGHT_MAX, PLANTAO_WEIGHT_MIN, plantaoPrioritySettingKey } from "../src/features/lead-distribution/plantao-priority-core";
import { FEATURE_FLAGS } from "../src/shared/feature-flags/catalog";

loadEnvConfig(process.cwd());

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
  const tenantId = argument("tenant-id");
  const actorUserId = argument("actor-user-id");
  const mode = argument("mode") ?? "shadow";
  const typeId = argument("type-id");
  const base = Number(argument("base") ?? "1.15");
  if (!tenantId || !actorUserId || !typeId) throw new Error("Use --tenant-id <id> --actor-user-id <diretor> --type-id <tipo> [--mode off|shadow|on] [--base 1.15] [--enable-flag] [--apply].");
  if (!["off", "shadow", "on"].includes(mode)) throw new Error("--mode precisa ser off, shadow ou on.");
  if (!Number.isFinite(base) || base < PLANTAO_WEIGHT_MIN || base > PLANTAO_WEIGHT_MAX) throw new Error("--base vai de 1.0 a 1.3.");
  const url = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL ou SUPABASE_DB_URL não configurado.");

  const key = plantaoPrioritySettingKey(tenantId);
  const enableFlag = process.argv.includes("--enable-flag");
  const apply = process.argv.includes("--apply");
  const db = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
  try {
    await db.begin(apply ? "read write" : "read only", async (tx) => {
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
      const [type] = await tx<{ id: string; name: string }[]>`select id, name from duty_schedule_types where id = ${typeId} and tenant_id = ${tenantId} limit 1`;
      if (!type) throw new Error("Tipo de plantão não encontrado nesta empresa.");
      const [stored] = await tx<{ value: string }[]>`select value from system_settings where key = ${key} limit 1`;
      const [flag] = await tx<{ value: string }[]>`select value from system_settings where key = ${FEATURE_FLAGS.PLANTAO_PRIORITY.key} limit 1`;
      const previous = normalizePlantaoPrioritySettings(stored ? JSON.parse(stored.value) : null);
      const next = normalizePlantaoPrioritySettings({ ...previous, mode, types: { ...previous.types, [typeId]: { base, adaptive: previous.types[typeId]?.adaptive ?? false } } });

      if (!apply) {
        console.log(JSON.stringify({ mode: "dry-run", key, type: type.name, previous, next, flag: { key: FEATURE_FLAGS.PLANTAO_PRIORITY.key, current: flag?.value ?? FEATURE_FLAGS.PLANTAO_PRIORITY.defaultValue, willEnable: enableFlag } }, null, 2));
        console.log("Revise e rode novamente com --apply para gravar e auditar.");
        return;
      }
      await tx`
        insert into system_settings (key, value, updated_at)
        values (${key}, ${JSON.stringify(next)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `;
      await tx`
        insert into audit_logs (id, user_id, entidade, entidade_id, acao, metadata, created_at)
        values (${randomUUID()}, ${actorUserId}, 'tenant', ${tenantId}, ${next.mode === "off" ? "tenant.plantao_priority_disabled" : "tenant.plantao_priority_updated"},
          ${JSON.stringify({ source: "operator_script", before: { mode: previous.mode, types: previous.types }, after: { mode: next.mode, types: next.types } })}::jsonb, now())
      `;
      if (enableFlag) {
        await tx`
          insert into system_settings (key, value, updated_at)
          values (${FEATURE_FLAGS.PLANTAO_PRIORITY.key}, 'true', now())
          on conflict (key) do update set value = excluded.value, updated_at = now()
        `;
        await tx`
          insert into audit_logs (id, user_id, entidade, entidade_id, acao, metadata, created_at)
          values (${randomUUID()}, ${actorUserId}, 'system_setting', ${FEATURE_FLAGS.PLANTAO_PRIORITY.key}, 'system_setting.updated',
            ${JSON.stringify({ source: "operator_script", before: flag?.value ?? null, after: "true" })}::jsonb, now())
        `;
      }
      console.log(`Prioridade por tipo de plantão gravada (${next.mode}) para ${type.name} = ${base}${enableFlag ? "; flag global ligada" : ""}.`);
    });
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao configurar a prioridade.");
  process.exitCode = 1;
});
