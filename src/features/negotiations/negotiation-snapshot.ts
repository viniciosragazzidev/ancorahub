import "server-only";

import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

import { getNegotiationsDashboard } from "./queries";
import { buildNegotiationSnapshot, parseClosingLeads, type NegotiationSnapshotHistoryRow } from "./negotiation-snapshot-model";

type DatabaseError = { code?: string; cause?: { code?: string } };

/** A tabela nasce com drizzle/0222; antes do SQL rodar, ler ou gravar a foto não pode derrubar nada. */
function isMissingTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as DatabaseError;
  return databaseError.code === "42P01" || databaseError.cause?.code === "42P01";
}

export type NegotiationSnapshotJobResult = {
  day: string | null;
  tenants: number;
  saved: number;
  failed: number;
  skipped?: "table_missing";
};

/**
 * Foto diária do Fechamento (09/11): para cada empresa ativa, calcula a tela de Negociações como o diretor a vê
 * (empresa toda, sem unidade) e grava a linha do dia de São Paulo. Idempotente: rodar de novo no mesmo dia
 * sobrescreve a linha (a última rodada do dia vence).
 */
export async function runNegotiationSnapshotJob(now = new Date()): Promise<NegotiationSnapshotJobResult> {
  const db = getDatabase();
  const tenants = await db.select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.status, "active"));
  const result: NegotiationSnapshotJobResult = { day: null, tenants: tenants.length, saved: 0, failed: 0 };
  for (const tenant of tenants) {
    try {
      const userId = await resolveSystemUserId(tenant.id);
      const context: TenantContext = { userId, tenantId: tenant.id, role: "director", jobTitle: "system", branchId: null };
      const data = await getNegotiationsDashboard(context, null, now);
      const snapshot = buildNegotiationSnapshot(data, now);
      result.day = snapshot.day;
      await db.insert(schema.negotiationDailySnapshots)
        .values({ id: randomUUID(), tenantId: tenant.id, day: snapshot.day, counts: snapshot.counts, closingLeads: snapshot.closingLeads, createdAt: now })
        .onConflictDoUpdate({
          target: [schema.negotiationDailySnapshots.tenantId, schema.negotiationDailySnapshots.day],
          set: { counts: sql`excluded.counts`, closingLeads: sql`excluded.closing_leads`, createdAt: sql`excluded.created_at` },
        });
      result.saved += 1;
    } catch (error) {
      if (isMissingTable(error)) return { ...result, skipped: "table_missing" };
      result.failed += 1;
      console.error("[negotiation-snapshot] tenant_failed", { tenantId: tenant.id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    }
  }
  return result;
}

/** Últimas fotos da empresa, da mais recente para a mais antiga. Sem a tabela (SQL ainda não rodou), volta vazio. */
export async function getNegotiationSnapshotHistory(tenantId: string, limit = 8): Promise<NegotiationSnapshotHistoryRow[]> {
  try {
    const rows = await getDatabase()
      .select({ day: schema.negotiationDailySnapshots.day, closingLeads: schema.negotiationDailySnapshots.closingLeads })
      .from(schema.negotiationDailySnapshots)
      .where(eq(schema.negotiationDailySnapshots.tenantId, tenantId))
      .orderBy(desc(schema.negotiationDailySnapshots.day))
      .limit(limit);
    return rows.map((row) => ({ day: String(row.day), closingLeads: parseClosingLeads(row.closingLeads) }));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}
