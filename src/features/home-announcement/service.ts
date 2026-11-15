import "server-only";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";

import { announcementSchema, isAnnouncementLive, type HomeAnnouncement, type HomeAnnouncementInput, type HomeAnnouncementView } from "./announcement";

const keyOf = (tenantId: string) => `home-announcement:${tenantId}`;

export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** O aviso salvo da empresa (ligado ou não), para o editor. Valor inválido ou ausente = nenhum. */
export async function getHomeAnnouncement(tenantId: string): Promise<HomeAnnouncement | null> {
  const raw = await getSystemSetting(keyOf(tenantId)).catch(() => undefined);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const data = announcementSchema.safeParse(parsed);
    if (!data.success) return null;
    return { ...data.data, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null };
  } catch {
    return null;
  }
}

/** O que o Início do corretor mostra: só quando está no ar hoje. */
export async function getLiveHomeAnnouncement(tenantId: string, now = new Date()): Promise<HomeAnnouncementView | null> {
  const announcement = await getHomeAnnouncement(tenantId);
  if (!announcement || !isAnnouncementLive(announcement, todayInSaoPaulo(now))) return null;
  const { title, body, button, art, tone } = announcement;
  return { title, body, button, art, tone };
}

export async function saveHomeAnnouncement(tenantId: string, userId: string, input: HomeAnnouncementInput, now = new Date()) {
  const value = { ...announcementSchema.parse(input), updatedAt: now.toISOString(), updatedBy: userId };
  await setSystemSetting(keyOf(tenantId), JSON.stringify(value), now);
  return { ...value, updatedAt: value.updatedAt } satisfies HomeAnnouncement & { updatedBy: string };
}
