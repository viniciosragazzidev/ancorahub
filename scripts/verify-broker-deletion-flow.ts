// ═════════════════════════════════════════════════════════════════════
// Script: verify-broker-deletion-flow.ts
// Descrição:  Varredura READ-ONLY no banco para encontrar corretores com
//             leads atribuídos e verificar o que aconteceria se fossem
//             excluídos (simulação do deleteTeamMemberAction).
// Uso:        npx tsx scripts/verify-broker-deletion-flow.ts
// ═════════════════════════════════════════════════════════════════════

import { loadEnvConfig } from "@next/env";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

loadEnvConfig(process.cwd());

async function main() {
  const { getDatabase, schema } = await import("../src/shared/db/client");

  const db = getDatabase();

  // ── 1. Buscar todos os tenants ──────────────────────────────────────
  const tenants = await db
    .select({ id: schema.tenants.id, name: schema.tenants.name })
    .from(schema.tenants);

  console.log(`🔍 Encontrados ${tenants.length} tenant(s).\n`);

  let totalBrokersWithLeads = 0;
  let totalLeadsAffected = 0;

  for (const tenant of tenants) {
    console.log(`╔══════════════════════════════════════════════════════════`);
    console.log(`║ Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`╚══════════════════════════════════════════════════════════`);

    // ── 2. Buscar corretores que têm leads atribuídos ──────────────────
    const brokersWithLeads = await db
      .select({
        userId: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        branchId: schema.tenantMemberships.branchId,
        branchName: schema.branches.name,
        leadCount: count(schema.leads.id),
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .innerJoin(schema.leads, eq(schema.leads.corretorId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, tenant.id),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.user.active, true),
        ),
      )
      .groupBy(
        schema.user.id,
        schema.user.name,
        schema.user.email,
        schema.tenantMemberships.branchId,
        schema.branches.name,
      );

    if (brokersWithLeads.length === 0) {
      console.log(`✅ Nenhum corretor com leads atribuídos encontrado.\n`);
      continue;
    }

    console.log(`\n📊 ${brokersWithLeads.length} corretor(es) com leads:\n`);

    for (const broker of brokersWithLeads) {
      totalBrokersWithLeads++;
      console.log(`  ── Corretor: ${broker.name} (${broker.email})`);
      console.log(`     ID:       ${broker.userId}`);
      console.log(`     Unidade:  ${broker.branchName ?? "Sem unidade"}`);
      console.log(`     Leads:    ${broker.leadCount}`);

      // ── 3. Detalhar os leads deste corretor ─────────────────────────
      const leads = await db
        .select({
          id: schema.leads.id,
          nome: schema.leads.nome,
          status: schema.leads.status,
          distributionStatus: schema.leads.distributionStatus,
          branchId: schema.leads.branchId,
          createdAt: schema.leads.createdAt,
        })
        .from(schema.leads)
        .where(
          and(
            eq(schema.leads.tenantId, tenant.id),
            eq(schema.leads.corretorId, broker.userId),
          ),
        )
        .orderBy(schema.leads.createdAt);

      for (const lead of leads) {
        totalLeadsAffected++;
        console.log(`     ├─ Lead: ${lead.nome} (${lead.id})`);
        console.log(`     │  Status: ${lead.status}`);
        console.log(`     │  Distribuição: ${lead.distributionStatus}`);
        console.log(`     │  Unidade: ${lead.branchId ?? "N/A"}`);
        console.log(`     │  Criado: ${lead.createdAt.toISOString()}`);
      }

      // ── 4. Simular o que aconteceria na exclusão ────────────────────
      console.log(`     │`);
      console.log(`     └─▶ Simulação da exclusão:`);
      console.log(`         Leads seriam atualizados:`);
      console.log(`         • corretorId: "${broker.userId}" → null`);
      console.log(`         • distributionStatus: → "returned_to_queue"`);
      console.log(`         • assignedAt: → null`);
      console.log(`         • distributionUpdatedAt: → now`);
      console.log(`         Por lead, seria inserido:`);
      console.log(`         • 1 leadInteractions ("system_alert")`);
      console.log(`         • 1 leadDistributionEvents ("returned_to_queue")`);
      console.log(`         • 1 auditLogs ("lead.returned_to_queue")`);
      console.log(`         Após leads, o membro seria excluído:`);
      console.log(`         • brokerInvitations → deletado`);
      console.log(`         • brokerProfiles → deletado`);
      console.log(`         • tenantMemberships → deletado`);
      console.log(`         • user → deletado`);
      console.log(`         • auditLogs → "excluiu_membro"\n`);
    }
  }

  // ── 5. Resumo final ─────────────────────────────────────────────────
  console.log(`╔══════════════════════════════════════════════════════════`);
  console.log(`║ RESUMO FINAL`);
  console.log(`╠══════════════════════════════════════════════════════════`);
  console.log(`║ Corretores com leads: ${totalBrokersWithLeads}`);
  console.log(`║ Leads que seriam afetados: ${totalLeadsAffected}`);
  console.log(`╚══════════════════════════════════════════════════════════`);

  if (totalLeadsAffected === 0) {
    console.log(`\n✅ Nenhum lead seria afetado — não há corretores com leads atribuídos.`);
  } else {
    console.log(`\n⚠️  Se a exclusão ocorresse, ${totalLeadsAffected} lead(s) seriam devolvidos`);
    console.log(`   à fila da unidade com distributonStatus="returned_to_queue".`);
    console.log(`   O histórico completo seria registrado (interactions + events + audit).`);
  }

  console.log(`\n📝 NOTA: Este script é READ-ONLY. Nenhum dado foi alterado.`);
}

void main().catch((error: unknown) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});
