"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { chooseAvailableBroker } from "@/features/leads/assignment";
import { notifyNewLead, notifyLeadArrived } from "@/features/notifications/send-push-helper";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";

const MAX_FILE_BYTES = 2_000_000;
const MAX_ROWS = 500;
const requestSchema = z.object({ branchId: z.string().uuid().optional().or(z.literal("")), consentimento: z.literal("true", { error: "Confirme que possui base legal para importar os contatos." }), file: z.instanceof(File).refine((file) => file.size > 0, "Selecione um arquivo CSV.").refine((file) => file.size <= MAX_FILE_BYTES, "O arquivo deve ter no máximo 2 MB.") });

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

function normalizePhone(value: string) { const digits = value.replace(/\D/g, ""); return digits.startsWith("55") ? digits : `55${digits}`; }

export async function importLeadsFromCsvAction(formData: FormData) {
  try {
    const context = await getRequiredTenantContext();
    if (!hasCapability(context.role, "importar_planilhas", context.jobTitle)) throw new AuthorizationError("Seu perfil não pode importar leads.");
    const input = requestSchema.parse({ file: formData.get("file"), branchId: formData.get("branchId") ?? "", consentimento: formData.get("consentimento") ?? "" });
    const branchId = context.role === "manager" ? context.branchId : input.branchId || null;
    if (!branchId) throw new Error("Selecione uma unidade para distribuir os leads importados.");
    const db = getDatabase();
    const [branch] = await db.select({ id: schema.branches.id }).from(schema.branches).where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"))).limit(1);
    if (!branch) throw new Error("A unidade selecionada não pertence à corretora ativa.");
    const rows = parseCsv(await input.file.text());
    const tipoImport = formData.get("tipo") === "PME" ? "PME" : "PF";
    let imported = 0; let duplicates = 0; const errors: Array<{ row: number; message: string }> = [];
    for (const row of rows) {
      try {
        const nome = row.nome.trim(); const telefone = normalizePhone(row.telefone); const email = row.email.trim() || null; const campanha = row.campanha.trim() || null;
        const rowTipo = row.tipo.toUpperCase().trim();
        const tipo = (rowTipo === "PME" || rowTipo === "PF") ? rowTipo : tipoImport;
        if (nome.length < 2) throw new Error("nome inválido");
        if (!/^(?:55)?(?:[1-9]{2})9\d{8}$/.test(telefone)) throw new Error("telefone inválido");
        if (email && !z.string().email().safeParse(email).success) throw new Error("e-mail inválido");
        const [existing] = await db.select({ id: schema.leads.id }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.telefone, telefone))).limit(1);
        if (existing) { duplicates += 1; continue; }
        const brokerId = await chooseAvailableBroker(context.tenantId, branchId);
        const leadId = randomUUID(); const assigned = Boolean(brokerId);
        await db.transaction(async (tx) => {
          await tx.insert(schema.leads).values({ id: leadId, tenantId: context.tenantId, branchId, corretorId: brokerId, nome, telefone, email, origem: "manual", tipo, sourceChannel: "bulk_import", sourceCampaign: campanha, sourceMetadata: { import: "csv" }, status: assigned ? "distributed" : "new", distributionStatus: assigned ? "assigned" : "queued", assignmentSource: assigned ? "automatic" : null, assignmentStrategy: assigned ? "capacity" : null, distributionUpdatedAt: new Date(), assignedAt: assigned ? new Date() : null, consentimentoLgpd: true });
          await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId, userId: context.userId, tipo: assigned ? "system_alert" : "note", conteudo: "Lead importado por arquivo CSV." });
          await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: leadId, acao: "lead.bulk_imported" });
        });
        void notifyLeadArrived(leadId, context.tenantId, branchId, nome).catch(console.error);
        void notifyNewLead(leadId, context.tenantId, branchId, brokerId, nome).catch(console.error);
        // Enqueue distribution job if lead was queued (no broker available)
        if (!assigned) {
          void enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId }).catch(console.error);
        }
        imported += 1;
      } catch (error) { errors.push({ row: row.row, message: error instanceof Error ? error.message : "linha inválida" }); }
    }
    return { success: true, imported, duplicates, errors };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Não foi possível importar os leads." }; }
}
