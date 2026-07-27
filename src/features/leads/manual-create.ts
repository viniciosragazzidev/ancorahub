import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";
import { chooseAvailableBroker } from "./assignment";

const leadInput = z.object({
  nome: z.string().trim().min(2, "Informe o nome do lead.").max(120),
  telefone: z.string().trim().transform((value) => value.replace(/\D/g, "")).refine((value) => /^(?:55)?(?:[1-9]{2})9\d{8}$/.test(value), "Informe um celular brasileiro válido."),
  email: z.string().trim().email("Informe um e-mail válido.").max(254).optional().or(z.literal("")),
  planoInteresseId: z.string().uuid().optional().or(z.literal("")),
  tipo: z.enum(["PF", "PME"]).default("PF"),
  consentimentoLgpd: z.literal("true", { message: "O consentimento LGPD é obrigatório." }),
  duplicateConfirmed: z.literal("true").optional(),
});

export type DuplicateLeadNotice = { id: string; nome: string; createdAt: Date; corretorNome: string | null };

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
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
  const assigned = Boolean(corretorId);
  await db.insert(schema.leads).values({ id: leadId, tenantId: context.tenantId, branchId: context.branchId, corretorId, planId: input.planoInteresseId || null, nome: input.nome, telefone, email: input.email || null, origem: "manual", tipo: input.tipo, status: assigned ? "distributed" : "new", distributionStatus: assigned ? "assigned" : "queued", assignmentSource: assigned ? "automatic" : null, assignmentStrategy: assigned ? "capacity" : null, distributionUpdatedAt: new Date(), assignedAt: assigned ? new Date() : null, consentimentoLgpd: true });
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

  return { leadId };
}
