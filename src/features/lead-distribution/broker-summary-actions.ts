"use server";

import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { fetchBrokerDailySummary, type BrokerDailySummaryAggregate } from "./broker-summary-service";

function assertAdminRole(role: string) {
  if (role !== "director" && role !== "manager") {
    throw new Error("Apenas Diretores ou Gestores podem visualizar o resumo de desempenho.");
  }
}

export const brokerSummaryQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "custom"]).default("today"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.string().optional().nullable(),
});

export type BrokerSummaryQueryInput = z.infer<typeof brokerSummaryQuerySchema>;

export async function getBrokerDailySummaryAction(
  input: BrokerSummaryQueryInput,
): Promise<BrokerDailySummaryAggregate> {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);

  const parsed = brokerSummaryQuerySchema.parse(input);
  const now = new Date();

  let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (parsed.period === "week") {
    // Start of last 7 days
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
  } else if (parsed.period === "month") {
    // Start of current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (parsed.period === "custom" && parsed.startDate) {
    startDate = new Date(parsed.startDate);
    if (parsed.endDate) {
      endDate = new Date(parsed.endDate);
    }
  }

  // Manager branch scope
  const targetBranchId =
    context.role === "manager" && context.branchId
      ? context.branchId
      : parsed.branchId || undefined;

  return fetchBrokerDailySummary(context.tenantId, {
    startDate,
    endDate,
    branchId: targetBranchId,
  });
}
