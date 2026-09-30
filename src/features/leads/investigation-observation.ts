import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";

import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const observationPrefix = /^Lead assumido para investigação por (?:Diretor|Gestor)\. Motivo:\s*/i;

export function extractInvestigationReason(content: string) {
  const match = content.match(observationPrefix);
  if (!match) return null;
  const reason = content.slice(match[0].length).trim();
  return reason || null;
}

export async function getLeadInvestigationObservation(leadIdInput: string) {
  const leadId = z.string().trim().min(1).max(128).parse(leadIdInput);
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas diretores e gestores podem consultar o motivo da investigação.");
  }
  if (context.role === "manager" && !context.branchId) {
    throw new AuthorizationError("Gestores precisam de uma filial ativa para consultar esta investigação.");
  }

  const db = getDatabase();
  const [interaction] = await db.select({
    content: schema.leadInteractions.conteudo,
    branchId: schema.leads.branchId,
  }).from(schema.leadInteractions)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
    .innerJoin(schema.tenantMemberships, and(
      eq(schema.tenantMemberships.tenantId, schema.leads.tenantId),
      eq(schema.tenantMemberships.userId, schema.leadInteractions.userId),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, context.tenantId),
      eq(schema.leads.status, "under_analysis"),
      eq(schema.leadInteractions.userId, schema.leads.corretorId),
      eq(schema.leadInteractions.tipo, "system_alert"),
      like(schema.leadInteractions.conteudo, "Lead assumido para investigação por %. Motivo: %"),
      inArray(schema.tenantMemberships.role, ["director", "manager"]),
      context.role === "manager" ? eq(schema.leads.branchId, context.branchId!) : undefined,
    ))
    .orderBy(desc(schema.leadInteractions.createdAt))
    .limit(1);

  const reason = interaction?.content ? extractInvestigationReason(interaction.content) : null;
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "lead",
    entidadeId: leadId,
    acao: "lead.investigation_observation_viewed",
    createdAt: new Date(),
  });
  return { reason };
}
