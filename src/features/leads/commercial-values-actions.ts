"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthorizationService } from "@/shared/auth/authorization-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { buildLeadResourceScope, toEffectiveLeadAccessContext } from "@/features/leads/lead-authorization";
import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getDatabase, schema } from "@/shared/db";

export type CommercialValuesActionState = {
  success?: boolean;
  error?: string;
  monthlyValue?: string | null;
  livesCount?: number | null;
};

const inputSchema = z.object({
  leadId: z.string().uuid("Lead inválido."),
  monthlyValue: z.string().trim().max(20).optional(),
  livesCount: z.string().trim().max(4).optional(),
});

export async function updateLeadCommercialValuesAction(
  _previous: CommercialValuesActionState,
  formData: FormData,
): Promise<CommercialValuesActionState> {
  const parsed = inputSchema.safeParse({
    leadId: formData.get("leadId"),
    monthlyValue: String(formData.get("monthlyValue") ?? ""),
    livesCount: String(formData.get("livesCount") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados informados." };

  const rawValue = parsed.data.monthlyValue ?? "";
  const compactValue = rawValue.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  const normalizedValue = compactValue.includes(",")
    ? compactValue.replace(/\./g, "").replace(",", ".")
    : compactValue;
  const monthlyValue = normalizedValue === "" ? null : Number(normalizedValue);
  const rawLives = parsed.data.livesCount ?? "";
  const livesCount = rawLives === "" ? null : Number(rawLives);

  if (monthlyValue !== null && (!Number.isFinite(monthlyValue) || monthlyValue < 0 || monthlyValue > 9999999999.99)) {
    return { error: "Informe um valor mensal válido." };
  }
  if (livesCount !== null && (!Number.isInteger(livesCount) || livesCount < 1 || livesCount > 100)) {
    return { error: "Informe de 1 a 100 vidas, ou deixe em branco." };
  }

  try {
    if ((await getSystemSetting(FEATURE_FLAGS.LEAD_COMMERCIAL_VALUES.key)) === "false") {
      return { error: "A edição de valor e vidas está desativada." };
    }
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db
      .select({ id: schema.leads.id, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.id, parsed.data.leadId),
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
      ))
      .limit(1);
    if (!lead) return { error: "Lead não encontrado." };

    const accessContext = toEffectiveLeadAccessContext(context);
    if (!AuthorizationService.can(accessContext, "acessar_leads", buildLeadResourceScope(lead))) {
      return { error: "Você não tem permissão para editar este lead." };
    }

    const [activeSale, activeProposal] = await Promise.all([
      db.select({ id: schema.sales.id }).from(schema.sales).where(and(
        eq(schema.sales.tenantId, context.tenantId), eq(schema.sales.leadId, lead.id), eq(schema.sales.status, "active"),
      )).limit(1),
      db.select({ id: schema.proposals.id }).from(schema.proposals).where(and(
        eq(schema.proposals.tenantId, context.tenantId),
        eq(schema.proposals.leadId, lead.id),
        inArray(schema.proposals.status, ["rascunho", "em_revisao", "enviada", "visualizada", "negociacao", "aprovada"]),
      )).limit(1),
    ]);
    if (activeSale.length || activeProposal.length) {
      return { error: "O valor vem de uma venda ou proposta ativa. Edite o registro de origem." };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.leads)
        .set({ monthlyValue: monthlyValue === null ? null : monthlyValue.toFixed(2), livesCount, updatedAt: now })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "lead.commercial_values_updated",
        createdAt: now,
      });
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${lead.id}`);
    return { success: true, monthlyValue: monthlyValue?.toFixed(2) ?? null, livesCount };
  } catch {
    return { error: "Não foi possível salvar o valor e as vidas agora." };
  }
}
