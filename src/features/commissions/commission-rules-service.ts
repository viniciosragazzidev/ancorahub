import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export type GeneratedScheduleItem = {
  id: string;
  tenantId: string;
  saleId: string;
  monthNumber: number;
  referenceMonth: string;
  dueDate: Date | null;
  percentage: string;
  amount: string;
  status: "pending";
};

/**
 * Busca a regra de comissão aplicável para um determinado carrierPlanId.
 *
 * Ordem de prioridade:
 * 1. Regra específica para o plano (planId = carrierPlanId)
 * 2. Regra para a operadora do plano (carrierId)
 * 3. Regra "apply to all" (appliesToAll = true)
 * 4. Regra padrão: 100% única se nada for encontrado
 */
export async function findApplicableCommissionRule(
  tenantId: string,
  carrierPlanId: string | null,
): Promise<{
  id: string | null;
  type: "unica" | "escalonada";
  percentages: number[];
} | null> {
  if (!carrierPlanId) return null;

  const db = getDatabase();

  // Buscar o plano para saber a operadora
  const [plan] = await db
    .select({ carrierId: schema.carrierPlans.carrierId })
    .from(schema.carrierPlans)
    .where(
      and(
        eq(schema.carrierPlans.id, carrierPlanId),
        eq(schema.carrierPlans.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!plan) return null;

  // Buscar regras ativas do tenant, ordenadas por especificidade
  const rows = await db
    .select({
      id: schema.commissionRules.id,
      type: schema.commissionRules.type,
      percentages: schema.commissionRules.percentages,
      planId: schema.commissionRules.planId,
      carrierId: schema.commissionRules.carrierId,
      appliesToAll: schema.commissionRules.appliesToAll,
    })
    .from(schema.commissionRules)
    .where(
      and(
        eq(schema.commissionRules.tenantId, tenantId),
        eq(schema.commissionRules.active, true),
        or(
          eq(schema.commissionRules.planId, carrierPlanId),
          eq(schema.commissionRules.carrierId, plan.carrierId),
          eq(schema.commissionRules.appliesToAll, true),
        ),
      ),
    )
    .orderBy(schema.commissionRules.createdAt);

  // Cast raw rule to typed object with number[] percentages
  const rules = rows.map((r) => ({
    ...r,
    percentages: Array.isArray(r.percentages) ? (r.percentages as number[]) : [100],
  }));

  // Prioridade: planId match > carrierId match > appliesToAll
  const planRule = rules.find((r) => r.planId === carrierPlanId);
  if (planRule) return planRule;

  const carrierRule = rules.find((r) => r.carrierId === plan.carrierId);
  if (carrierRule) return carrierRule;

  const allRule = rules.find((r) => r.appliesToAll);
  if (allRule) return allRule;

  return null;
}

/**
 * Gera as parcelas do cronograma de repasse com base na regra de comissão.
 */
export function generateScheduleFromRule(
  params: {
    saleId: string;
    tenantId: string;
    saleValue: number;
    type: "unica" | "escalonada";
    percentages: number[];
  },
): GeneratedScheduleItem[] {
  const { saleId, tenantId, saleValue, percentages } = params;
  const now = new Date();

  return percentages.map((pct, index) => {
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + index);
    dueDate.setDate(10); // Pagamento no dia 10

    const year = dueDate.getFullYear();
    const month = String(dueDate.getMonth() + 1).padStart(2, "0");

    return {
      id: randomUUID(),
      tenantId,
      saleId,
      monthNumber: index + 1,
      referenceMonth: `${year}-${month}`,
      dueDate,
      percentage: pct.toFixed(2),
      amount: ((saleValue * pct) / 100).toFixed(2),
      status: "pending",
    };
  });
}

/**
 * Função completa: busca a regra aplicável e gera o cronograma.
 * Retorna o schedule gerado ou array vazio se não houver regra.
 */
export async function generateCommissionSchedule(
  tenantId: string,
  saleId: string,
  carrierPlanId: string | null,
  saleValue: number,
): Promise<GeneratedScheduleItem[]> {
  const rule = await findApplicableCommissionRule(tenantId, carrierPlanId);

  if (!rule) {
    // Sem regra configurada → gera schedule padrão: 1 parcela de 100%
    return generateScheduleFromRule({
      saleId,
      tenantId,
      saleValue,
      type: "unica",
      percentages: [100],
    });
  }

  const percentages = Array.isArray(rule.percentages)
    ? rule.percentages.map((p) => Number(p))
    : [100];

  return generateScheduleFromRule({
    saleId,
    tenantId,
    saleValue,
    type: rule.type,
    percentages,
  });
}
