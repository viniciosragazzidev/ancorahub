"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";
import { PILOT_SETTING, pilotConfigSchema } from "./contracts";
import { loadPilotIndex } from "./server";

const adminInput = z.object({ release: z.string().max(80), operation: z.enum(["enable", "disable", "review", "unreview", "hide", "show"]), planId: z.string().uuid().optional(), reason: z.string().trim().min(10, "Descreva o motivo com pelo menos 10 caracteres.").max(1000) });
export async function updatePilotAction(input: unknown) {
  try {
    const admin = await getRequiredPlatformAdmin(); const parsed = adminInput.parse(input);
    await getDatabase().transaction(async tx => {
      const [row] = await tx.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, PILOT_SETTING)).for("update").limit(1);
      if (!row) throw new Error("Catálogo ainda não publicado.");
      const config = pilotConfigSchema.parse(JSON.parse(row.value));
      if (config.release !== parsed.release) throw new Error("O lote mudou. Atualize a página antes de continuar.");
      if (!["enable", "disable"].includes(parsed.operation)) {
        const index = await loadPilotIndex(config);
        if (!parsed.planId || !index.plans.some(p => p.id === parsed.planId)) throw new Error("Selecione um plano deste lote.");
        const key = parsed.operation === "review" || parsed.operation === "unreview" ? "reviewedPlanIds" : "hiddenPlanIds";
        const values = new Set(config[key]);
        if (parsed.operation === "review" || parsed.operation === "hide") values.add(parsed.planId); else values.delete(parsed.planId);
        config[key] = [...values];
      } else config.enabled = parsed.operation === "enable";
      await tx.update(schema.systemSettings).set({ value: JSON.stringify(config), updatedAt: new Date() }).where(eq(schema.systemSettings.key, PILOT_SETTING));
      await tx.insert(schema.platformAuditLogs).values({ id: randomUUID(), actorUserId: admin.userId, action: `quote_catalog.${parsed.operation}`, targetType: "quote_catalog_pilot", targetId: parsed.planId || config.release, metadata: { release: config.release, userId: config.userId, tenantId: config.tenantId, reason: parsed.reason } });
    });
    revalidatePath("/cotacao"); revalidatePath("/super-admin/catalogo"); return { success: true };
  } catch (error) { return { error: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error && ["O lote mudou.", "Selecione um plano", "Catálogo ainda"].some(v => error.message.startsWith(v)) ? error.message : "Não foi possível atualizar o piloto." }; }
}
