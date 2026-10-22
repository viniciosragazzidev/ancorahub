"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { listCarrierFacts, listSourceFacts } from "./queries";
import { approveFacts, approvePlan, approveSuggestion, rejectFacts, rejectPlan, rejectSuggestion, resolveMissingFacts } from "./review";
import { brokerQuotesImportStatus, pauseBrokerQuotesImport, startBrokerQuotesImport } from "./broker-quotes";
import { catalogOperatorSource } from "./service";

const PATH = "/ferramentas/materiais-operadoras";
type Result = { success: true; message: string } | { success: false; error: string };

async function director() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Só o diretor revisa o catálogo das operadoras.");
  return context;
}

function failure(error: unknown, fallback: string): Result {
  console.error("[operator-catalog] action_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
  return { success: false, error: error instanceof Error && error.message.startsWith("Só o diretor") ? error.message : fallback };
}

const ids = z.array(z.string().min(1).max(64)).min(1).max(2000);

export async function approveFactsAction(factIds: string[]): Promise<Result> {
  try {
    const context = await director();
    const result = await approveFacts(context.tenantId, ids.parse(factIds), context.userId);
    revalidatePath(PATH);
    const prices = result.priceVersions ? ` ${result.priceVersions} tabela(s) de preço atualizada(s).` : "";
    return { success: true, message: `${result.approved} informação(ões) aprovada(s).${prices}` };
  } catch (error) {
    return failure(error, "Não foi possível aprovar agora.");
  }
}

export async function rejectFactsAction(factIds: string[]): Promise<Result> {
  try {
    const context = await director();
    const count = await rejectFacts(context.tenantId, ids.parse(factIds), context.userId);
    revalidatePath(PATH);
    return { success: true, message: `${count} informação(ões) descartada(s).` };
  } catch (error) {
    return failure(error, "Não foi possível descartar agora.");
  }
}

export async function approvePlanAction(planId: string, name?: string): Promise<Result> {
  try {
    const context = await director();
    const result = await approvePlan(context.tenantId, z.string().min(1).parse(planId), context.userId, name);
    if (!result) return { success: false, error: "Plano não encontrado." };
    revalidatePath(PATH);
    return { success: true, message: `Plano aprovado com ${result.approved} informação(ões).` };
  } catch (error) {
    return failure(error, "Não foi possível aprovar o plano agora.");
  }
}

export async function rejectPlanAction(planId: string): Promise<Result> {
  try {
    const context = await director();
    await rejectPlan(context.tenantId, z.string().min(1).parse(planId), context.userId);
    revalidatePath(PATH);
    return { success: true, message: "Plano descartado." };
  } catch (error) {
    return failure(error, "Não foi possível descartar o plano agora.");
  }
}

export async function resolveMissingFactsAction(factIds: string[], decision: "remove" | "keep"): Promise<Result> {
  try {
    const context = await director();
    const count = await resolveMissingFacts(context.tenantId, ids.parse(factIds), z.enum(["remove", "keep"]).parse(decision), context.userId);
    revalidatePath(PATH);
    return { success: true, message: decision === "remove" ? `${count} informação(ões) retirada(s) do catálogo.` : `${count} informação(ões) mantida(s).` };
  } catch (error) {
    return failure(error, "Não foi possível salvar agora.");
  }
}

export async function reviewSuggestionAction(suggestionId: string, decision: "approve" | "reject", label?: string): Promise<Result> {
  try {
    const context = await director();
    const id = z.string().min(1).parse(suggestionId);
    const ok = decision === "approve"
      ? await approveSuggestion(context.tenantId, id, context.userId, label?.slice(0, 120))
      : await rejectSuggestion(context.tenantId, id, context.userId);
    if (!ok) return { success: false, error: "Sugestão não encontrada." };
    revalidatePath(PATH);
    return { success: true, message: decision === "approve" ? "Incluída no catálogo." : "Sugestão descartada." };
  } catch (error) {
    return failure(error, "Não foi possível salvar agora.");
  }
}

/** Reads the file again; with an operator chosen, the AI uses it instead of guessing. */
export async function reprocessMaterialAction(sourceId: string, carrierId?: string | null): Promise<Result> {
  try {
    const context = await director();
    const db = getDatabase();
    if (carrierId) {
      const [carrier] = await db.select({ id: schema.tenantPrivateCarriers.id }).from(schema.tenantPrivateCarriers)
        .where(and(eq(schema.tenantPrivateCarriers.id, carrierId), eq(schema.tenantPrivateCarriers.tenantId, context.tenantId))).limit(1);
      if (!carrier) return { success: false, error: "Operadora não encontrada." };
    }
    const [source] = await db.update(schema.knowledgeSources)
      .set({ catalogStatus: "pending", catalogAttempts: 0, ...(carrierId ? { carrierId } : {}), updatedAt: new Date() })
      .where(and(
        eq(schema.knowledgeSources.id, z.string().min(1).parse(sourceId)),
        eq(schema.knowledgeSources.tenantId, context.tenantId),
        eq(schema.knowledgeSources.category, OPERATOR_MATERIAL_CATEGORY),
      ))
      .returning({ id: schema.knowledgeSources.id });
    if (!source) return { success: false, error: "Material não encontrado." };
    after(() => catalogOperatorSource(context.tenantId, source.id).catch(() => undefined));
    revalidatePath(PATH);
    return { success: true, message: "Catalogação reiniciada. Atualize em alguns instantes." };
  } catch (error) {
    return failure(error, "Não foi possível reprocessar agora.");
  }
}

export async function loadSourceFactsAction(sourceId: string) {
  const context = await director();
  return listSourceFacts(context.tenantId, z.string().min(1).parse(sourceId));
}

export async function loadCarrierFactsAction(carrierId: string, areaSlug?: string | null) {
  const context = await director();
  return listCarrierFacts(context.tenantId, z.string().min(1).parse(carrierId), areaSlug ?? null);
}

export async function getBrokerQuotesImportAction() {
  const context = await director();
  return brokerQuotesImportStatus(context.tenantId);
}

export async function startBrokerQuotesImportAction(): Promise<Result> {
  try {
    const context = await director();
    await startBrokerQuotesImport(context.tenantId);
    return { success: true, message: "Importação iniciada. Os PDFs entram em lotes a cada 5 minutos." };
  } catch (error) {
    return failure(error, "Não foi possível iniciar agora.");
  }
}

export async function pauseBrokerQuotesImportAction(): Promise<Result> {
  try {
    const context = await director();
    await pauseBrokerQuotesImport(context.tenantId);
    return { success: true, message: "Importação pausada." };
  } catch (error) {
    return failure(error, "Não foi possível pausar agora.");
  }
}
