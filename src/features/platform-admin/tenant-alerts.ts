import "server-only";

import { count, eq } from "drizzle-orm";

import { getQualificationAlerts } from "@/features/ai-qualification/alerts-service";
import { directionQuestionsReady } from "@/features/ai-qualification/direction-questions-service";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

import { buildTenantAlertRows, type TenantAlertRow } from "./tenant-alerts-core";

/**
 * Alertas por empresa da visão geral do super-admin (26/11): alertas abertos da IA (os mesmos de /ia/alertas, calculados
 * agora e gravados) e perguntas para a direção abertas (só se a tabela existe). Falhou numa empresa: ela fica sem número.
 */
export async function getTenantAlertRows(now = new Date()): Promise<{ rows: TenantAlertRow[]; questionsReady: boolean }> {
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  const tenants = await db.select({ id: schema.tenants.id, name: schema.tenants.name, status: schema.tenants.status })
    .from(schema.tenants)
    .orderBy(schema.tenants.name);

  const questionsReady = await directionQuestionsReady();
  const [alertCounts, questionRows] = await Promise.all([
    Promise.all(tenants.map(async (tenant) => {
      const alerts = await getQualificationAlerts(tenant.id, now).catch(() => null);
      return [tenant.id, alerts ? alerts.filter((alert) => alert.status === "active").length : null] as const;
    })),
    questionsReady
      ? db.select({ tenantId: schema.aiDirectionQuestions.tenantId, value: count() })
        .from(schema.aiDirectionQuestions)
        .where(eq(schema.aiDirectionQuestions.status, "open"))
        .groupBy(schema.aiDirectionQuestions.tenantId)
        .catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    rows: buildTenantAlertRows(tenants, new Map(alertCounts), questionRows ? new Map(questionRows.map((row) => [row.tenantId, Number(row.value)])) : null),
    questionsReady: questionsReady && questionRows !== null,
  };
}
