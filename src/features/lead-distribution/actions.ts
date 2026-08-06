"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import {
  routeLeadToBranch,
  assignLeadToBroker,
  processQueuedLead,
  routeLeadToBranchAndAssignBroker,
} from "./service";
import { enqueueLeadDistributionJob } from "./jobs";
import { getDatabase, schema } from "@/shared/db";
import { randomUUID } from "node:crypto";
import { retryLeadEffectForTenant } from "@/features/leads/webhooks/services/lead-effect-outbox";

export type DistributionActionState = {
  success?: boolean;
  message?: string;
  error?: string;
  processed?: number;
  conflicts?: number;
};
const leadId = z.string().uuid();
const branchId = z.string().uuid();
const brokerId = z.string().uuid();

const distributionPolicySchema = z.object({
  excludedBrokerIds: z.array(z.string().uuid()).default([]),
  excludedBranchIds: z.array(z.string().uuid()).default([]),
  ranking: z.object({
    enabled: z.boolean(),
    conversionWeight: z.number().int().min(0).max(100),
    slaWeight: z.number().int().min(0).max(100),
    manualPriorityWeight: z.number().int().min(0).max(100),
  }),
});

export async function saveDistributionPolicyAction(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  const parsed = distributionPolicySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Revise as regras de distribuição." };
  const total =
    parsed.data.ranking.conversionWeight +
    parsed.data.ranking.slaWeight +
    parsed.data.ranking.manualPriorityWeight;
  if (total > 100)
    return { success: false, error: "Os pesos do ranking não podem ultrapassar 100." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director")
      return { success: false, error: "Apenas o Diretor pode alterar a política de distribuição." };
    const db = getDatabase();
    const now = new Date();
    const [existing] = await db
      .select({
        id: schema.leadDistributionPolicies.id,
        version: schema.leadDistributionPolicies.version,
      })
      .from(schema.leadDistributionPolicies)
      .where(
        and(
          eq(schema.leadDistributionPolicies.tenantId, context.tenantId),
          isNull(schema.leadDistributionPolicies.queueId),
        ),
      )
      .limit(1);
    if (existing)
      await db
        .update(schema.leadDistributionPolicies)
        .set({
          policy: parsed.data,
          version: existing.version + 1,
          updatedBy: context.userId,
          updatedAt: now,
        })
        .where(eq(schema.leadDistributionPolicies.id, existing.id));
    else
      await db.insert(schema.leadDistributionPolicies).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        enabled: true,
        policy: parsed.data,
        updatedBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead_distribution_policy",
      entidadeId: existing?.id ?? context.tenantId,
      acao: "distribution_policy.updated",
    });
    refreshDistribution();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar a política.",
    };
  }
}

function refreshDistribution() {
  revalidatePath("/leads");
  revalidatePath("/leads/distribuicao");
  revalidatePath("/dashboard");
}

export async function retryLeadEffectAction(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("effectId"));
  if (!parsed.success) throw new Error("Efeito inválido.");
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager")
    throw new Error("Sem permissão para reprocessar efeitos.");
  const [effect] = await getDatabase()
    .select({ id: schema.leadEffectOutbox.id, branchId: schema.leads.branchId })
    .from(schema.leadEffectOutbox)
    .innerJoin(schema.leads, eq(schema.leadEffectOutbox.leadId, schema.leads.id))
    .where(
      and(
        eq(schema.leadEffectOutbox.id, parsed.data),
        eq(schema.leadEffectOutbox.tenantId, context.tenantId),
        eq(schema.leads.tenantId, context.tenantId),
      ),
    )
    .limit(1);
  if (!effect || (context.role === "manager" && effect.branchId !== context.branchId))
    throw new Error("Efeito não encontrado no seu escopo.");
  const retried = await retryLeadEffectForTenant({
    tenantId: context.tenantId,
    effectId: effect.id,
  });
  if (!retried) throw new Error("Este efeito não está disponível para reprocessamento.");
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "lead_effect_outbox",
    entidadeId: effect.id,
    acao: "lead_effect.retry_requested",
  });
  refreshDistribution();
}

export async function routeLeadToBranchAction(
  _previous: DistributionActionState,
  formData: FormData,
): Promise<DistributionActionState> {
  const parsed = z
    .object({ leadId, branchId, reason: z.string().trim().min(3).max(200).optional() })
    .safeParse({
      leadId: formData.get("leadId"),
      branchId: formData.get("branchId"),
      reason: String(formData.get("reason") ?? "") || undefined,
    });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Selecione uma unidade válida." };
  try {
    const context = await getRequiredTenantContext();
    const result = await routeLeadToBranch(
      context,
      parsed.data.leadId,
      parsed.data.branchId,
      parsed.data.reason,
    );
    if (result.status !== "routed")
      return {
        error:
          result.status === "conflict"
            ? "Este lead já foi atribuído."
            : "A unidade não pode receber leads agora.",
      };
    await enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: parsed.data.leadId });
    refreshDistribution();
    return { success: true, message: "Lead enviado para a fila da unidade." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível enviar o lead para a unidade.",
    };
  }
}

export async function assignLeadToBrokerAction(
  _previous: DistributionActionState,
  formData: FormData,
): Promise<DistributionActionState> {
  const parsed = z
    .object({ leadId, brokerId, reason: z.string().trim().min(3).max(200).optional() })
    .safeParse({
      leadId: formData.get("leadId"),
      brokerId: formData.get("brokerId"),
      reason: String(formData.get("reason") ?? "") || undefined,
    });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Selecione um corretor válido." };
  try {
    const result = await assignLeadToBroker(
      await getRequiredTenantContext(),
      parsed.data.leadId,
      parsed.data.brokerId,
      undefined,
      parsed.data.reason,
    );
    if (result.status !== "assigned") return { error: result.reason };
    refreshDistribution();
    const message = result.notificationWarnings?.length
      ? `Lead atribuído ao corretor. Aviso: ${result.notificationWarnings.join("; ")}`
      : "Lead atribuído ao corretor.";
    return { success: true, message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atribuir o lead." };
  }
}

export async function routeAndAssignLeadAction(
  _previous: DistributionActionState,
  formData: FormData,
): Promise<DistributionActionState> {
  const parsed = z
    .object({ leadId, branchId, brokerId, reason: z.string().trim().min(3).max(200).optional() })
    .safeParse({
      leadId: formData.get("leadId"),
      branchId: formData.get("branchId"),
      brokerId: formData.get("brokerId"),
      reason: String(formData.get("reason") ?? "") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director")
      return { error: "Apenas Diretores podem rotear e atribuir em uma única operação." };
    const result = await routeLeadToBranchAndAssignBroker(
      context,
      parsed.data.leadId,
      parsed.data.branchId,
      parsed.data.brokerId,
      parsed.data.reason,
    );
    if (result.status !== "assigned") return { error: result.reason };
    await enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: parsed.data.leadId });
    refreshDistribution();
    const message = result.notificationWarnings?.length
      ? `Lead roteado e atribuído. Aviso: ${result.notificationWarnings.join("; ")}`
      : "Lead roteado para unidade e atribuído ao corretor.";
    return { success: true, message };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível processar a operação.",
    };
  }
}

export async function distributeLeadAutomaticallyAction(
  _previous: DistributionActionState,
  formData: FormData,
): Promise<DistributionActionState> {
  const parsed = leadId.safeParse(formData.get("leadId"));
  if (!parsed.success) return { error: "Lead inválido." };
  try {
    const result = await processQueuedLead(await getRequiredTenantContext(), parsed.data);
    refreshDistribution();
    if (result.status !== "assigned") return { error: result.reason };
    const message = result.notificationWarnings?.length
      ? `Lead distribuído automaticamente. Aviso: ${result.notificationWarnings.join("; ")}`
      : "Lead distribuído automaticamente.";
    return { success: true, message };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível distribuir o lead.",
    };
  }
}

export async function distributeLeadBatchAction(
  _previous: DistributionActionState,
  formData: FormData,
): Promise<DistributionActionState> {
  const ids = String(formData.get("leadIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const parsed = z.array(leadId).safeParse(ids);
  if (!parsed.success || !parsed.data.length)
    return { error: "Selecione ao menos um lead válido." };
  const branch = branchId.safeParse(formData.get("branchId"));
  if (!branch.success) return { error: "Selecione uma unidade." };
  try {
    const context = await getRequiredTenantContext();
    let processed = 0;
    let conflicts = 0;
    const enqueuePromises: Promise<unknown>[] = [];
    for (const id of parsed.data) {
      const result = await routeLeadToBranch(context, id, branch.data, "Distribuição em lote");
      if (result.status === "routed") {
        processed += 1;
        enqueuePromises.push(
          enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: id }).catch(() => {}),
        );
      } else {
        conflicts += 1;
      }
    }
    await Promise.allSettled(enqueuePromises);
    refreshDistribution();
    return {
      success: conflicts === 0,
      processed,
      conflicts,
      message: `${processed} lead${processed === 1 ? "" : "s"} enviado${processed === 1 ? "" : "s"} para a unidade.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível processar o lote." };
  }
}

export async function assignLeadBatchToBrokerAction(
  _previous: DistributionActionState,
  formData: FormData,
): Promise<DistributionActionState> {
  const ids = String(formData.get("leadIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const parsed = z.array(leadId).safeParse(ids);
  if (!parsed.success || !parsed.data.length)
    return { error: "Selecione ao menos um lead válido." };
  const broker = brokerId.safeParse(formData.get("brokerId"));
  if (!broker.success) return { error: "Selecione um corretor." };
  const branch = branchId.safeParse(formData.get("branchId"));
  if (!branch.success) return { error: "Selecione uma unidade." };
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const leads = await db
      .select({ id: schema.leads.id, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(
        and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, parsed.data)),
      );
    const branchByLead = new Map(leads.map((lead) => [lead.id, lead.branchId]));
    let processed = 0;
    let conflicts = 0;
    for (const id of parsed.data) {
      const result = branchByLead.get(id)
        ? await assignLeadToBroker(context, id, broker.data, undefined, "Atribuição em lote")
        : await routeLeadToBranchAndAssignBroker(
            context,
            id,
            branch.data,
            broker.data,
            "Atribuição em lote",
          );
      if (result.status === "assigned") processed += 1;
      else conflicts += 1;
    }
    refreshDistribution();
    return {
      success: conflicts === 0,
      processed,
      conflicts,
      message: `${processed} lead${processed === 1 ? "" : "s"} atribuído${processed === 1 ? "" : "s"} ao corretor.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível processar o lote." };
  }
}
