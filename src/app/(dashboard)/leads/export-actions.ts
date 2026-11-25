"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { hasEffectiveRouteAccess } from "@/features/custom-roles/service";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import {
  SELECTED_LEAD_EXPORT_LIMIT,
  buildSelectedLeadsCsv,
  buildSelectedLeadsFilename,
  normalizeSelectedLeadIds,
} from "@/features/leads/selected-lead-export";
import { resolveAccessContext } from "@/shared/auth/access-context";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type ExportSelectedLeadsResult =
  | { ok: true; csv: string; filename: string; exported: number; requested: number }
  | { ok: false; error: string };

/**
 * Exporta os leads selecionados na lista. O cliente manda só os ids; o servidor
 * aplica o escopo do usuário (diretor: empresa; gestor: unidades; supervisor: equipe;
 * corretor: os seus) e devolve apenas o que ele pode ver. Ids fora do escopo somem em silêncio
 * e entram na contagem "ficaram de fora".
 */
export async function exportSelectedLeadsAction(rawIds: unknown): Promise<ExportSelectedLeadsResult> {
  const leadIds = normalizeSelectedLeadIds(Array.isArray(rawIds) ? rawIds : []);
  if (leadIds.length === 0) return { ok: false, error: "Selecione ao menos um lead." };
  if (leadIds.length > SELECTED_LEAD_EXPORT_LIMIT) {
    return { ok: false, error: `Exporte até ${SELECTED_LEAD_EXPORT_LIMIT} leads por vez.` };
  }

  try {
    const context = await getRequiredTenantContext();
    const routeAllowed = await hasEffectiveRouteAccess({
      tenantId: context.tenantId,
      role: context.role,
      jobTitle: context.jobTitle,
      customRoleId: context.customRoleId ?? null,
      routeKey: "leads",
    });
    if (!routeAllowed) return { ok: false, error: "Seu perfil não pode acessar a área de leads." };

    const access = await resolveAccessContext(context);
    if (!access.permissions.has("acessar_leads")) return { ok: false, error: "Seu perfil não pode acessar leads." };
    if (context.role === "supervisor" && !access.scope.teamScoped) {
      return { ok: false, error: "Este supervisor não tem uma equipe ativa no escopo." };
    }

    const db = getDatabase();
    const rows = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        email: schema.leads.email,
        status: schema.leads.status,
        corretorNome: schema.user.name,
        queueName: schema.leadQueues.name,
        branchName: schema.branches.name,
        origem: schema.leads.origem,
        sourceChannel: schema.leads.sourceChannel,
        sourceCampaign: schema.leads.sourceCampaign,
        monthlyValue: schema.leads.monthlyValue,
        livesCount: schema.leads.livesCount,
        createdAt: schema.leads.createdAt,
        assignedAt: schema.leads.assignedAt,
        updatedAt: schema.leads.updatedAt,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .leftJoin(
        schema.leadQueues,
        and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, context.tenantId)),
      )
      .leftJoin(
        schema.branches,
        and(eq(schema.branches.id, schema.leads.branchId), eq(schema.branches.tenantId, context.tenantId)),
      )
      .where(and(buildLeadScopeWhere(access), inArray(schema.leads.id, leadIds), isNull(schema.leads.deletedAt)));

    if (rows.length === 0) return { ok: false, error: "Nenhum dos leads selecionados está no seu acesso." };

    const generatedAt = new Date();
    const filename = buildSelectedLeadsFilename(generatedAt);
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "report",
      entidadeId: "selected_leads",
      acao: `report.generated:selected-leads:${rows.length}:csv`,
      metadata: {
        tenantId: context.tenantId,
        requested: leadIds.length,
        count: rows.length,
        format: "csv",
        generatedAt: generatedAt.toISOString(),
      },
    });

    return {
      ok: true,
      csv: buildSelectedLeadsCsv(rows, leadIds, context.role),
      filename,
      exported: rows.length,
      requested: leadIds.length,
    };
  } catch {
    return { ok: false, error: "Não consegui gerar o arquivo agora." };
  }
}
