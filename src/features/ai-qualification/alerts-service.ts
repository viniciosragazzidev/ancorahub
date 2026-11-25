import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getLiveQualificationAlerts } from "./live-alerts";

export type QualificationAlertRecord = {
  id: string;
  tenantId: string;
  alertType: string;
  level: "info" | "warning" | "critical";
  status: "active" | "acknowledged" | "resolved";
  message: string;
  suggestedAction: string | null;
  createdAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  /** Calculado agora a partir dos fatos: some sozinho quando o problema acaba (não tem "Resolver"). */
  live?: boolean;
  /** Tela onde se resolve o problema. */
  href?: string;
};

/**
 * Textos dos alertas de exemplo que este serviço gravava quando a empresa não tinha nenhum (até 25/11/2026).
 * Eram falsos e apareciam como reais no Simulador e no Agente IA; são apagados na próxima leitura.
 */
export const LEGACY_SAMPLE_ALERT_MESSAGES = [
  "Fila de qualificados possui 2 leads aguardando sem corretor disponível no plantão.",
  "Latência do webhook Meta oscilou acima de 800ms nos últimos 15 minutos.",
];

/**
 * Alertas da operação: os calculados agora a partir dos fatos (live-alerts.ts) e os gravados por quem
 * detecta um problema (createQualificationAlert). Sem problema, a lista vem vazia: nunca há alerta de exemplo.
 */
export async function getQualificationAlerts(tenantId: string, now = new Date()): Promise<QualificationAlertRecord[]> {
  const db = getDatabase();
  const live = await getLiveQualificationAlerts(tenantId, now).catch((err) => {
    console.error("[alerts-service] Error computing live alerts:", err);
    return [] as QualificationAlertRecord[];
  });

  try {
    await db
      .delete(schema.aiQualificationAlerts)
      .where(and(eq(schema.aiQualificationAlerts.tenantId, tenantId), inArray(schema.aiQualificationAlerts.message, LEGACY_SAMPLE_ALERT_MESSAGES)));

    const alerts = await db
      .select()
      .from(schema.aiQualificationAlerts)
      .where(eq(schema.aiQualificationAlerts.tenantId, tenantId))
      .orderBy(desc(schema.aiQualificationAlerts.createdAt))
      .limit(50);

    return [
      ...live,
      ...alerts.map((a) => ({
        id: a.id,
        tenantId: a.tenantId,
        alertType: a.alertType,
        level: a.level as "info" | "warning" | "critical",
        status: a.status as "active" | "acknowledged" | "resolved",
        message: a.message,
        suggestedAction: a.suggestedAction,
        createdAt: a.createdAt,
        resolvedAt: a.resolvedAt,
        resolvedBy: a.resolvedBy,
      })),
    ];
  } catch (err) {
    console.error("[alerts-service] Error querying alerts:", err);
    return live;
  }
}

export async function acknowledgeAlert(tenantId: string, actorUserId: string, alertId: string) {
  const db = getDatabase();
  const now = new Date();

  // Alerta calculado na hora não tem linha no banco: some sozinho quando o fato some.
  if (!alertId.startsWith("live:")) {
    await db
      .update(schema.aiQualificationAlerts)
      .set({
        status: "resolved",
        resolvedAt: now,
        resolvedBy: actorUserId,
      })
      .where(and(eq(schema.aiQualificationAlerts.id, alertId), eq(schema.aiQualificationAlerts.tenantId, tenantId)));

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actorUserId,
      entidade: "ai_qualification_alert",
      entidadeId: alertId,
      acao: "alert.resolved",
    });
  }

  return getQualificationAlerts(tenantId);
}

export async function createQualificationAlert(input: {
  tenantId: string;
  alertType: "qualified_without_routing" | "queue_no_broker" | "whatsapp_latency_spike";
  level?: "info" | "warning" | "critical";
  message: string;
  suggestedAction?: string;
}) {
  const db = getDatabase();
  const alertId = randomUUID();
  const now = new Date();

  await db.insert(schema.aiQualificationAlerts).values({
    id: alertId,
    tenantId: input.tenantId,
    alertType: input.alertType,
    level: input.level ?? "critical",
    status: "active",
    message: input.message,
    suggestedAction: input.suggestedAction ?? null,
    createdAt: now,
  });

  console.error(`[CRITICAL_ALERT:${input.alertType}]`, {
    tenantId: input.tenantId,
    message: input.message,
    level: input.level ?? "critical",
  });

  return alertId;
}
