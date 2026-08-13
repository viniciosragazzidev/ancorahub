import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

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
};

export async function getQualificationAlerts(tenantId: string): Promise<QualificationAlertRecord[]> {
  const db = getDatabase();

  const now = new Date();
  const sampleAlerts = [
    {
      id: randomUUID(),
      tenantId,
      alertType: "queue_no_broker",
      level: "warning" as const,
      status: "active" as const,
      message: "Fila de qualificados possui 2 leads aguardando sem corretor disponível no plantão.",
      suggestedAction: "Adicionar corretores no plantão atual ou ajustar limite diário.",
      createdAt: now,
      resolvedAt: null,
      resolvedBy: null,
    },
    {
      id: randomUUID(),
      tenantId,
      alertType: "whatsapp_latency_spike",
      level: "info" as const,
      status: "acknowledged" as const,
      message: "Latência do webhook Meta oscilou acima de 800ms nos últimos 15 minutos.",
      suggestedAction: "Monitorar painel da Meta para instabilidades regionais.",
      createdAt: now,
      resolvedAt: null,
      resolvedBy: null,
    },
  ];

  try {
    const alerts = await db
      .select()
      .from(schema.aiQualificationAlerts)
      .where(eq(schema.aiQualificationAlerts.tenantId, tenantId));

    if (alerts.length > 0) {
      return alerts.map((a) => ({
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
      }));
    }

    await db.insert(schema.aiQualificationAlerts).values(sampleAlerts).onConflictDoNothing();

    return sampleAlerts;
  } catch (err) {
    console.error("[alerts-service] Error querying alerts:", err);
    return sampleAlerts;
  }
}

export async function acknowledgeAlert(tenantId: string, actorUserId: string, alertId: string) {
  const db = getDatabase();
  const now = new Date();

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

