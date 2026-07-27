/**
 * Conta e lista leads sem unidade (branchId IS NULL) no banco.
 *
 * Uso: npx tsx scripts/count-leads-without-unit.ts
 */
import { loadEnvConfig } from "@next/env";
import { count, eq, isNull } from "drizzle-orm";
import { getDatabase, schema } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

async function main() {
  const db = getDatabase();

  // Total leads sem unidade
  const [totalResult] = await db
    .select({ total: count() })
    .from(schema.leads)
    .where(isNull(schema.leads.branchId));

  const total = Number(totalResult?.total ?? 0);

  if (total === 0) {
    console.log("✅ Nenhum lead sem unidade encontrado. O guardrail já está funcionando!");
    return;
  }

  // Listar primeiros 20 para amostra
  const sample = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      distributionStatus: schema.leads.distributionStatus,
      origem: schema.leads.origem,
      createdAt: schema.leads.createdAt,
    })
    .from(schema.leads)
    .where(isNull(schema.leads.branchId))
    .orderBy(schema.leads.createdAt)
    .limit(20);

  console.log(`\n📊 Total de leads sem unidade: ${total}\n`);
  console.log("Amostra (até 20):");
  console.table(sample.map((lead) => ({
    ID: lead.id.slice(0, 8) + "...",
    Nome: lead.nome,
    Telefone: lead.telefone,
    Status: lead.status,
    Distribuição: lead.distributionStatus,
    Origem: lead.origem,
    Criado: lead.createdAt.toISOString().slice(0, 10),
  })));

  console.log(`\n💡 Acesse /leads/distribuicao para atribuir esses leads a uma unidade.`);
}

main().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});
