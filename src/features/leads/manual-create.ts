import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";
import { startAiQualificationForLead } from "@/features/ai-qualification/service";
import { chooseAvailableBroker } from "@/features/leads/assignment";

const formDataSchema = z.object({
  dependentes: z.string().optional().nullable(),
  mediaIdades: z.string().optional().nullable(),
  razaoSocial: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  funcionarios: z.string().optional().nullable(),
});

const leadInput = z.object({
  nome: z.string().trim().min(2, "Informe o nome do lead.").max(120),
  telefone: z.string().trim().transform((value) => value.replace(/\D/g, "")).refine((value) => /^(?:55)?(?:[1-9]{2})9\d{8}$/.test(value), "Informe um celular brasileiro válido."),
  email: z.string().trim().email("Informe um e-mail válido.").max(254).optional().or(z.literal("")),
  planoInteresseId: z.string().uuid().optional().or(z.literal("")),
  // PME remains accepted for historical records; new registrations use the clearer PJ label.
  tipo: z.enum(["PF", "PJ", "PME"]).default("PF"),
  consentimentoLgpd: z.literal("true", { message: "O consentimento LGPD é obrigatório." }),
  duplicateConfirmed: z.literal("true").optional(),
  formData: z.string().optional().transform((value) => {
    if (!value) return {};
    try {
      return formDataSchema.parse(JSON.parse(value));
    } catch {
      return {};
    }
  }),
});

export type DuplicateLeadNotice = { id: string; nome: string; createdAt: Date; corretorNome: string | null };

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function normalizeCnpj(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 14 ? digits : null;
}

import { notifyNewLead, notifyLeadArrived } from "@/features/notifications/send-push-helper";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";

export async function createManualLead(rawInput: unknown) {
  const input = leadInput.parse(rawInput);
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "criar_lead_manual")) throw new AuthorizationError("O papel atual não pode criar leads.");
  if (!context.branchId) throw new Error("O usuário precisa estar vinculado a uma filial ativa.");
  const db = getDatabase();
  const telefone = normalizePhone(input.telefone);
  if (input.planoInteresseId) {
    const [legacyPlan, catalogPlans] = await Promise.all([
      db
        .select({ id: schema.carrierPlans.id })
        .from(schema.carrierPlans)
        .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
        .where(and(
          eq(schema.carrierPlans.id, input.planoInteresseId),
          eq(schema.carrierPlans.tenantId, context.tenantId),
          eq(schema.carrierPlans.active, true),
          eq(schema.carriers.status, "active"),
        ))
        .limit(1),
      listAvailableCatalogPlans(context),
    ]);
    if (!legacyPlan[0] && !catalogPlans.some((plan) => plan.planId === input.planoInteresseId)) {
      throw new Error("O plano de interesse não está disponível para esta corretora.");
    }
  }
  const [duplicate] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, createdAt: schema.leads.createdAt, corretorNome: schema.user.name }).from(schema.leads).leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id)).where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.telefone, telefone))).orderBy(asc(schema.leads.createdAt)).limit(1);
  if (duplicate && input.duplicateConfirmed !== "true") return { duplicate: duplicate as DuplicateLeadNotice };
  const corretorId = context.role === "broker" ? context.userId : await chooseAvailableBroker(context.tenantId, context.branchId);
  const leadId = randomUUID();
  const cnpj = input.tipo === "PF" ? null : normalizeCnpj(input.formData.cnpj);
  if (input.tipo !== "PF" && input.formData.cnpj && !cnpj) {
    throw new Error("Informe um CNPJ com 14 dígitos para a empresa.");
  }
  let companyId: string | null = null;
  if (input.tipo !== "PF" && input.formData.razaoSocial?.trim()) {
    const [existingCompany] = await db.select({ id: schema.companies.id })
      .from(schema.companies)
      .where(and(eq(schema.companies.tenantId, context.tenantId), cnpj ? eq(schema.companies.cnpj, cnpj) : eq(schema.companies.legalName, input.formData.razaoSocial.trim())))
      .limit(1);
    companyId = existingCompany?.id ?? randomUUID();
    if (!existingCompany) {
      await db.insert(schema.companies).values({
        id: companyId,
        tenantId: context.tenantId,
        branchId: context.branchId,
        name: input.formData.razaoSocial.trim(),
        legalName: input.formData.razaoSocial.trim(),
        cnpj,
        employeeCount: input.formData.funcionarios ? Number(input.formData.funcionarios) : null,
        createdBy: context.userId,
      });
    }
  }
  const assigned = Boolean(corretorId);
  await db.insert(schema.leads).values({
    id: leadId,
    tenantId: context.tenantId,
    branchId: context.branchId,
    companyId,
    corretorId,
    planId: input.planoInteresseId || null,
    nome: input.nome,
    telefone,
    email: input.email || null,
    origem: "manual",
    tipo: input.tipo,
    status: assigned ? "distributed" : "new",
    distributionStatus: assigned ? "assigned" : "queued",
    assignmentSource: assigned ? "automatic" : null,
    assignmentStrategy: assigned ? "capacity" : null,
    distributionUpdatedAt: new Date(),
    assignedAt: assigned ? new Date() : null,
    consentimentoLgpd: true,
    formData: input.formData,
  });
  await db.insert(schema.leadInteractions).values({ id: randomUUID(), leadId, userId: context.userId, tipo: assigned ? "system_alert" : "note", conteudo: assigned ? "Lead criado e distribuído automaticamente para um corretor disponível." : "Lead criado manualmente; aguardando corretor disponível." });
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: leadId, acao: "criou" });
  
  // Keep WhatsApp outbox processing inside the server action. Vercel can
  // terminate a function immediately after returning, dropping unawaited work.
  void notifyLeadArrived(leadId, context.tenantId, context.branchId, input.nome).catch(console.error);
  await notifyNewLead(leadId, context.tenantId, context.branchId, corretorId, input.nome).catch((error) => {
    console.error("[createManualLead] notification delivery failed:", error);
  });

  // Enqueue distribution job if lead was queued (no broker available immediately)
  if (!assigned) {
    void enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId }).catch(console.error);
  }

  // Auto-initiate AI qualification if active
  void startAiQualificationForLead({ tenantId: context.tenantId, leadId, actorUserId: context.userId }).catch((err) => {
    console.error("[createManualLead] AI qualification start failed:", err);
  });

  return { leadId };
}
