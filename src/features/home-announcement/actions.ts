"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { announcementSchema, type HomeAnnouncement } from "./announcement";
import { saveHomeAnnouncement } from "./service";

type Result = { ok: true; data: HomeAnnouncement } | { ok: false; error: string };

/** Só o diretor publica o aviso do Início: ele vale para todos os corretores da empresa. */
export async function saveHomeAnnouncementAction(raw: unknown): Promise<Result> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só a diretoria publica o aviso do Início." };
    if (context.viewAs) return { ok: false, error: "No modo \"Ver como\" não dá para publicar." };
    const parsed = announcementSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." };
    const saved = await saveHomeAnnouncement(context.tenantId, context.userId, parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/relacionamento");
    return { ok: true, data: { ...parsed.data, updatedAt: saved.updatedAt } };
  } catch (error) {
    console.error("[home-announcement] save failed", error);
    return { ok: false, error: "Não deu para salvar agora. Tente de novo em instantes." };
  }
}
