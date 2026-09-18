/**
 * Reparo em lote de registros legados: leads com `corretorId` preenchido mas
 * `distributionStatus` de fila (unassigned/queued/returned_to_queue).
 *
 * Invariante restaurada: tem corretor ⇒ distributionStatus="assigned"
 * (mesma correção aplicada ao código em management-actions.ts). O reparo não
 * toca `status`, `assignedAt` ou titularidade — apenas o rótulo de distribuição.
 *
 * Por tenant, o ator do audit log e dos eventos é o usuário do
 * resolveSystemUserId (padrão do projeto, cf. offers.ts). Idempotente: uma
 * segunda execução não encontra nada a reparar.
 *
 * Uso:
 *   npx tsx scripts/repair-stale-distribution-status.ts              # dry-run (padrão)
 *   npx tsx scripts/repair-stale-distribution-status.ts --apply      # aplica
 *   npx tsx scripts/repair-stale-distribution-status.ts --apply --tenant <uuid>
 */
import { loadEnvConfig } from "@next/env";
import { and, asc, count, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

/**
 * Equivalente inline de resolveSystemUserId (src/shared/tenant/system-user.ts);
 * o módulo original importa "server-only" e não pode ser carregado por tsx.
 */
async function resolveActorId(tenantId: string): Promise<string> {
  const db = getDatabase();
  const [activeMember] = await db
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.status, "active")))
    .orderBy(asc(schema.tenantMemberships.createdAt))
    .limit(1);
  if (activeMember?.userId) return activeMember.userId;
  const [anyMember] = await db
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(eq(schema.tenantMemberships.tenantId, tenantId))
    .limit(1);
  return anyMember?.userId ?? "system";
}

const QUEUE_STATUSES = ["unassigned", "queued", "returned_to_queue"] as const;
const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const tenantArgIndex = args.indexOf("--tenant");
const tenantFilter = tenantArgIndex >= 0 ? args[tenantArgIndex + 1] : undefined;

function stalePredicate(tenantId?: string) {
  // Normalização de rótulo: tem corretor ⇒ não está em fila, sem exceção de
  // terminais (lost/desqualificado TAMBÉM têm dono; não há nada a reativar —
  // apenas o rótulo deixa de mentir).
  return and(
    inArray(schema.leads.distributionStatus, [...QUEUE_STATUSES]),
    isNotNull(schema.leads.corretorId),
    isNull(schema.leads.deletedAt),
    tenantId ? eq(schema.leads.tenantId, tenantId) : undefined,
  );
}

async function repairTenant(tenantId: string, now: Date): Promise<number> {
  const db = getDatabase();
  const actorId = await resolveActorId(tenantId);
  let repaired = 0;

  // Loop em lotes: a cada transação reavaliamos o predicado, então leads que
  // mudarem de estado concorrentemente simplesmente deixam de ser reparados.
  for (;;) {
    const batch = await db
      .select({
        id: schema.leads.id,
        distributionStatus: schema.leads.distributionStatus,
        assignmentSource: schema.leads.assignmentSource,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
      })
      .from(schema.leads)
      .where(stalePredicate(tenantId))
      .orderBy(schema.leads.distributionUpdatedAt)
      .limit(BATCH_SIZE);
    if (!batch.length) break;

    const repairedAutomaticOfferIds: string[] = [];

    await db.transaction(async (tx) => {
      const changed = await tx
        .update(schema.leads)
        .set({
          distributionStatus: "assigned",
          distributionUpdatedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            inArray(
              schema.leads.id,
              batch.map((lead) => lead.id),
            ),
            inArray(schema.leads.distributionStatus, [...QUEUE_STATUSES]),
            isNotNull(schema.leads.corretorId),
          ),
        )
        .returning({ id: schema.leads.id, assignmentSource: schema.leads.assignmentSource });
      const changedIds = new Set(changed.map((row) => row.id));
      if (changed.length) {
        // Owners provisórios (DEC-104) voltam ao ciclo do motor APENAS se não
        // forem terminais: lost/desqualificados são de outra esteira e o branch
        // de recuperação do motor também os exclui.
        for (const row of changed) {
          const batchRow = batch.find((lead) => lead.id === row.id);
          const isTerminal =
            batchRow?.status === "lost" || batchRow?.qualificationStatus === "disqualified";
          if (row.assignmentSource === "automatic_offer" && !isTerminal) {
            repairedAutomaticOfferIds.push(row.id);
          }
        }
        await tx.insert(schema.leadDistributionEvents).values(
          batch
            .filter((lead) => changedIds.has(lead.id))
            .map((lead) => ({
              id: randomUUID(),
              tenantId,
              leadId: lead.id,
              action: "distribution_status_repaired",
              source: "system_recovery",
              strategy: "automatic",
              reason: `Registro legado com corretor e status "${lead.distributionStatus}"; normalizado para "assigned".`,
              actorId,
              createdAt: now,
            })),
        );
      }

      return changed.length;
    });

    // Espelha enqueueLeadDistributionJob (jobs.ts importa "server-only" e não
    // pode ser carregado por tsx). Idempotente por lead via unique index.
    for (const leadId of repairedAutomaticOfferIds) {
      await db
        .insert(schema.leadDistributionJobs)
        .values({
          id: randomUUID(),
          tenantId,
          leadId,
          type: "process_queued_lead",
          status: "pending",
          runAfter: now,
          idempotencyKey: `process_queued_lead:${leadId}`,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    repaired += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorId,
    entidade: "lead_distribution",
    entidadeId: tenantId,
    acao: apply ? "lead.distribution_status_legacy_repair" : "lead.distribution_status_legacy_repair_dry_run",
  });

  return repaired;
}

async function main() {
  const db = getDatabase();
  const now = new Date();

  // Totais por tenant e por status atual (diagnóstico prévio)
  const byStatus = await db
    .select({
      tenantId: schema.leads.tenantId,
      distributionStatus: schema.leads.distributionStatus,
      total: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(stalePredicate(tenantFilter))
    .groupBy(schema.leads.tenantId, schema.leads.distributionStatus)
    .orderBy(schema.leads.tenantId);

  if (!byStatus.length) {
    console.log("✅ Nenhum registro legado encontrado. Nada a reparar.");
    return;
  }

  console.log(`\n📋 Registros legados ${apply ? "a reparar" : "encontrados (dry-run)"}:\n`);
  const byTenant = new Map<string, number>();
  for (const row of byStatus) {
    const total = Number(row.total);
    byTenant.set(row.tenantId, (byTenant.get(row.tenantId) ?? 0) + total);
    console.log(
      `  tenant ${row.tenantId} · ${row.distributionStatus.padEnd(18)} ${total}`,
    );
  }
  console.log("");
  for (const [tenantId, total] of byTenant) {
    console.log(`  tenant ${tenantId}: ${total} lead(s)`);
  }
  console.log(`\n  TOTAL: ${[...byTenant.values()].reduce((a, b) => a + b, 0)} lead(s)\n`);

  if (!apply) {
    console.log("💡 Dry-run concluído. Para aplicar: npx tsx scripts/repair-stale-distribution-status.ts --apply");
    return;
  }

  const tenantIds = tenantFilter ? [tenantFilter] : [...byTenant.keys()];
  for (const tenantId of tenantIds) {
    const repaired = await repairTenant(tenantId, now);
    console.log(`🔧 tenant ${tenantId}: ${repaired} lead(s) normalizado(s) para "assigned".`);
  }
  console.log("\n✅ Reparo concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
