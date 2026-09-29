"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import {
  enqueueAndProcessLeadDistribution,
} from "@/features/lead-distribution/jobs";
import { runWithConcurrency } from "@/utils/async/run-with-concurrency";
import { getSystemSetting } from "@/features/system-settings/queries";
import { startAiQualificationForLead } from "@/features/ai-qualification/service";
import {
  buildBulkImportDistributionState,
  getBulkImportDistributionReadiness,
  isAutomaticQueueAvailableForBulkImport,
  shouldQualifyBulkImportLead,
} from "./bulk-import-policy";

const MAX_FILE_BYTES = 2_000_000;
const MAX_ROWS = 500;
const requestSchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal("")),
  queueId: z.string().uuid().optional().or(z.literal("")),
  consentimento: z.literal("true", { error: "Confirme que possui base legal para importar os contatos." }),
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, "Selecione um arquivo CSV.")
    .refine((file) => file.size <= MAX_FILE_BYTES, "O arquivo deve ter no máximo 2 MB."),
});

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos um lead.");
  const separator = lines[0].includes(";") ? ";" : ",";
  const split = (line: string) => line.split(separator).map((value) => value.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]).map((header) => header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const nameIndex = headers.findIndex((header) => ["nome", "name", "full_name"].includes(header));
  const phoneIndex = headers.findIndex((header) => ["telefone", "phone", "phone_number", "celular"].includes(header));
  const emailIndex = headers.findIndex((header) => ["email", "e-mail", "email_address"].includes(header));
  const campaignIndex = headers.findIndex((header) => ["campanha", "nome da campanha", "nome_da_campanha", "campaign", "campaign_name"].includes(header));
  const tipoIndex = headers.findIndex((header) => ["tipo", "tipo do lead", "tipo_do_lead", "lead_type", "type"].includes(header));
  if (nameIndex < 0 || phoneIndex < 0) throw new Error("O cabeçalho precisa conter as colunas nome e telefone.");
  if (lines.length - 1 > MAX_ROWS) throw new Error(`Importe no máximo ${MAX_ROWS} leads por arquivo.`);
  return lines.slice(1).map((line, index) => {
    const values = split(line);
    return {
      row: index + 2,
      nome: values[nameIndex] ?? "",
      telefone: values[phoneIndex] ?? "",
      email: emailIndex >= 0 ? values[emailIndex] ?? "" : "",
      campanha: campaignIndex >= 0 ? values[campaignIndex] ?? "" : "",
      tipo: tipoIndex >= 0 ? values[tipoIndex] ?? "" : ""
    };
  });
}

import { ensureBrazilPhone as normalizePhone } from "@/shared/utils/phone";

export async function importLeadsFromCsvAction(formData: FormData) {
  try {
    const context = await getRequiredTenantContext();
    if (!hasCapability(context.role, "importar_planilhas", context.jobTitle)) throw new AuthorizationError("Seu perfil não pode importar leads.");
    
    const input = requestSchema.parse({
      file: formData.get("file"),
      branchId: formData.get("branchId") ?? "",
      queueId: formData.get("queueId") ?? "",
      consentimento: formData.get("consentimento") ?? "",
    });

    const branchId = context.role === "manager" ? context.branchId : input.branchId || null;
    if (!branchId) throw new Error("Selecione uma unidade para distribuir os leads importados.");

    const db = getDatabase();
    const [branch] = await db
      .select({
        id: schema.branches.id,
        acceptingLeads: schema.branches.acceptingLeads,
        autoDistribute: schema.branches.autoDistribute,
        isDistributionHub: schema.branches.isDistributionHub,
      })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
      .limit(1);

    if (!branch) throw new Error("A unidade selecionada não pertence à corretora ativa.");
    const distributionReadiness = getBulkImportDistributionReadiness(branch);
    if (!distributionReadiness.allowed) throw new Error(distributionReadiness.reason);

    // Check if AI qualification is enabled globally for this tenant
    const isQualificationEngineActive =
      (await getSystemSetting("feature_qualification_engine_enabled")) === "true" ||
      (await getSystemSetting("feature_ai_whatsapp_qualification_enabled")) === "true";

    const targetQueueId = input.queueId || null;
    const [targetQueue] = targetQueueId
      ? await db
          .select({
            id: schema.leadQueues.id,
            branchId: schema.leadQueues.branchId,
            assignmentMode: schema.leadQueues.assignmentMode,
            aiQualificationEnabled: schema.leadQueues.aiQualificationEnabled,
          })
          .from(schema.leadQueues)
          .where(and(
            eq(schema.leadQueues.id, targetQueueId),
            eq(schema.leadQueues.tenantId, context.tenantId),
            eq(schema.leadQueues.status, "active"),
            isNull(schema.leadQueues.deletedAt),
          ))
          .limit(1)
      : [];

    if (targetQueueId && !targetQueue) {
      throw new Error("A fila selecionada não está ativa nesta corretora.");
    }
    if (
      targetQueue &&
      !isAutomaticQueueAvailableForBulkImport(targetQueue, branchId)
    ) {
      throw new Error(
        targetQueue.assignmentMode === "manual"
          ? "A fila selecionada está em modo manual e não pode receber uma importação automática."
          : "A fila selecionada pertence a outra unidade.",
      );
    }
    const shouldQualifyLead = shouldQualifyBulkImportLead({
      qualificationEngineEnabled: isQualificationEngineActive,
      queueAiQualificationEnabled: targetQueue?.aiQualificationEnabled ?? null,
    });
    const rows = parseCsv(await input.file.text());
    const tipoImport = formData.get("tipo") === "PME" ? "PME" : "PF";

    const [pausedPolicy] = await db
      .select({ id: schema.leadDistributionPolicies.id })
      .from(schema.leadDistributionPolicies)
      .where(and(
        eq(schema.leadDistributionPolicies.tenantId, context.tenantId),
        targetQueueId
          ? eq(schema.leadDistributionPolicies.queueId, targetQueueId)
          : isNull(schema.leadDistributionPolicies.queueId),
        isNull(schema.leadDistributionPolicies.profileKey),
        eq(schema.leadDistributionPolicies.enabled, false),
      ))
      .limit(1);

    if (distributionReadiness.activateAutoDistribution || pausedPolicy) {
      const now = new Date();
      await db.transaction(async (tx) => {
        if (distributionReadiness.activateAutoDistribution) {
          await tx
            .update(schema.branches)
            .set({ autoDistribute: true, updatedAt: now })
            .where(and(
              eq(schema.branches.id, branch.id),
              eq(schema.branches.tenantId, context.tenantId),
              eq(schema.branches.autoDistribute, false),
            ));
          await tx.insert(schema.auditLogs).values({
            id: randomUUID(),
            userId: context.userId,
            entidade: "branch",
            entidadeId: branch.id,
            acao: "bulk_import.auto_distribution_activated",
          });
        }
        if (pausedPolicy) {
          await tx
            .update(schema.leadDistributionPolicies)
            .set({ enabled: true, updatedBy: context.userId, updatedAt: now })
            .where(and(
              eq(schema.leadDistributionPolicies.id, pausedPolicy.id),
              eq(schema.leadDistributionPolicies.tenantId, context.tenantId),
            ));
          await tx.insert(schema.auditLogs).values({
            id: randomUUID(),
            userId: context.userId,
            entidade: "lead_distribution_policy",
            entidadeId: pausedPolicy.id,
            acao: "bulk_import.distribution_policy_activated",
          });
        }
      });
    }

    let imported = 0;
    let duplicates = 0;
    const errors: Array<{ row: number; message: string }> = [];
    const distributionLeadIds: string[] = [];

    for (const row of rows) {
      try {
        const nome = row.nome.trim();
        const telefone = normalizePhone(row.telefone);
        const email = row.email.trim() || null;
        const campanha = row.campanha.trim() || null;
        const rowTipo = row.tipo.toUpperCase().trim();
        const tipo = (rowTipo === "PME" || rowTipo === "PF") ? rowTipo : tipoImport;

        if (nome.length < 2) throw new Error("nome inválido");
        if (!/^(?:55)?(?:[1-9]{2})9\d{8}$/.test(telefone)) throw new Error("telefone inválido");
        if (email && !z.string().email().safeParse(email).success) throw new Error("e-mail inválido");

        const [existing] = await db
          .select({ id: schema.leads.id })
          .from(schema.leads)
          .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.telefone, telefone)))
          .limit(1);

        if (existing) {
          duplicates += 1;
          continue;
        }

        const leadId = randomUUID();

        if (shouldQualifyLead) {
          // Qualification Engine Active: Lead enters qualification first, and is targeted to targetQueueId
          await db.transaction(async (tx) => {
            await tx.insert(schema.leads).values({
              id: leadId,
              tenantId: context.tenantId,
              branchId,
              corretorId: null,
              queueId: targetQueueId,
              nome,
              telefone,
              email,
              origem: "manual",
              tipo,
              sourceChannel: "bulk_import",
              sourceCampaign: campanha,
              sourceMetadata: { import: "csv", targetQueueId },
              status: "new",
              qualificationStatus: "pending",
              qualificationState: "NOT_STARTED",
              distributionStatus: "queued",
              distributionUpdatedAt: new Date(),
              consentimentoLgpd: true,
            });

            await tx.insert(schema.leadInteractions).values({
              id: randomUUID(),
              leadId,
              userId: context.userId,
              tipo: "note",
              conteudo: "Lead importado via arquivo CSV e encaminhado para o processo de Qualificação IA.",
            });

            await tx.insert(schema.auditLogs).values({
              id: randomUUID(),
              userId: context.userId,
              entidade: "lead",
              entidadeId: leadId,
              acao: "lead.bulk_imported_with_qualification",
            });
          });

          void startAiQualificationForLead({
            tenantId: context.tenantId,
            leadId,
            actorUserId: context.userId,
          }).catch(console.error);

        } else {
          // Qualification Engine Inactive: persist first, then use the same
          // durable offer engine as every other automatic lead entry.
          const distributionState = buildBulkImportDistributionState();

          await db.transaction(async (tx) => {
            await tx.insert(schema.leads).values({
              id: leadId,
              tenantId: context.tenantId,
              branchId,
              ...distributionState,
              queueId: targetQueueId,
              nome,
              telefone,
              email,
              origem: "manual",
              tipo,
              sourceChannel: "bulk_import",
              sourceCampaign: campanha,
              sourceMetadata: { import: "csv", targetQueueId },
              distributionUpdatedAt: new Date(),
              consentimentoLgpd: true,
            });

            await tx.insert(schema.leadInteractions).values({
              id: randomUUID(),
              leadId,
              userId: context.userId,
              tipo: "note",
              conteudo: "Lead importado por arquivo CSV e encaminhado para a fila de distribuição.",
            });

            await tx.insert(schema.auditLogs).values({
              id: randomUUID(),
              userId: context.userId,
              entidade: "lead",
              entidadeId: leadId,
              acao: "lead.bulk_imported",
            });
          });

          distributionLeadIds.push(leadId);
        }

        imported += 1;
      } catch (error) {
        errors.push({ row: row.row, message: error instanceof Error ? error.message : "linha inválida" });
      }
    }

    if (imported > 0 && !shouldQualifyLead) {
      try {
        await runWithConcurrency(distributionLeadIds, 5, async (leadId) => {
          await enqueueAndProcessLeadDistribution({
            tenantId: context.tenantId,
            leadId,
            source: "intake",
          });
        });
      } catch (error) {
        // Do not report a committed import as failed. Every lead remains
        // queued and can be recovered by the scheduled processor.
        console.error("[bulk-lead-import] immediate_distribution_failed", {
          tenantId: context.tenantId,
          imported,
          error: error instanceof Error ? error.name : "unknown_error",
        });
      }
    }

    return { success: true, imported, duplicates, errors };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível importar os leads." };
  }
}
