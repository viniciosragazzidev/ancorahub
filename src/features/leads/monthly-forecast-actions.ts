"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";

import { forecastChancesKey, normalizeForecastChancesInput, parseForecastChances, type ForecastChances } from "./monthly-forecast";

export type SaveForecastChancesResult = { ok: true; chances: ForecastChances } | { ok: false; reason: string };

/** Só o diretor ajusta a chance de cada etapa da previsão do mês, para a empresa toda. */
export async function saveForecastChancesAction(input: unknown): Promise<SaveForecastChancesResult> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { ok: false, reason: "Só o diretor ajusta as chances." };
  const parsed = normalizeForecastChancesInput(input);
  if (!parsed.ok) return parsed;
  const key = forecastChancesKey(context.tenantId);
  try {
    const previous = parseForecastChances(await getSystemSetting(key));
    await setSystemSetting(key, JSON.stringify(parsed.chances));
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead_forecast",
      entidadeId: context.tenantId,
      acao: "lead_forecast.chances_updated",
      metadata: { from: previous, to: parsed.chances },
      createdAt: new Date(),
    }).catch(() => undefined);
  } catch {
    return { ok: false, reason: "Não foi possível salvar as chances agora." };
  }
  revalidatePath("/leads");
  return { ok: true, chances: parsed.chances };
}
