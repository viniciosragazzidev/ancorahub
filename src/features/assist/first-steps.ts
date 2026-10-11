import "server-only";

import { and, count, eq, isNotNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export type FirstStepKey = "photo" | "whatsapp" | "availability" | "tour" | "first_contact";
export type FirstStep = { key: FirstStepKey; title: string; detail: string; href: string; done: boolean };

/** Order matters: the easiest first, the real work last. "tour" is checked in the browser (local). */
const STEPS: Omit<FirstStep, "done">[] = [
  { key: "photo", title: "Coloque sua foto", detail: "Os clientes e a equipe reconhecem você.", href: "/settings?tab=conta" },
  { key: "whatsapp", title: "Conecte seu WhatsApp", detail: "Para mandar a primeira mensagem pelo app.", href: "/settings?tab=whatsapp" },
  { key: "availability", title: "Diga quando você atende", detail: "Dias e horários em que recebe leads.", href: "/settings?tab=disponibilidade" },
  { key: "tour", title: "Faça o tour de 3 minutos", detail: "Mostra onde fica cada coisa.", href: "/dashboard?tour=1" },
  { key: "first_contact", title: "Faça seu primeiro atendimento", detail: "Aceite um lead e mande a primeira mensagem.", href: "/minha-fila" },
];

/**
 * First steps of a new broker (plan §5, E8). Server facts only; a failing read
 * counts as done so the card never nags by mistake. Returns null when every
 * server step is done (the tour is then the only thing left, and the welcome
 * card already offers it).
 */
export async function getFirstSteps(tenantId: string, userId: string): Promise<FirstStep[] | null> {
  const db = getDatabase();
  const [user, whatsapp, windows, contacted] = await Promise.all([
    db.select({ image: schema.user.image }).from(schema.user).where(eq(schema.user.id, userId)).limit(1).catch(() => null),
    db.select({ status: schema.whatsappConnections.status }).from(schema.whatsappConnections).where(and(eq(schema.whatsappConnections.tenantId, tenantId), eq(schema.whatsappConnections.userId, userId))).limit(1).catch(() => null),
    db.select({ total: count() }).from(schema.brokerAvailabilityWindows).where(and(eq(schema.brokerAvailabilityWindows.tenantId, tenantId), eq(schema.brokerAvailabilityWindows.brokerId, userId))).catch(() => null),
    db.select({ total: count() }).from(schema.leads).where(and(eq(schema.leads.tenantId, tenantId), eq(schema.leads.corretorId, userId), isNotNull(schema.leads.firstContactAt))).catch(() => null),
  ]);
  const done: Record<FirstStepKey, boolean> = {
    photo: user === null ? true : Boolean(user[0]?.image),
    whatsapp: whatsapp === null ? true : whatsapp[0]?.status === "ready",
    availability: windows === null ? true : Number(windows[0]?.total ?? 0) > 0,
    tour: true,
    first_contact: contacted === null ? true : Number(contacted[0]?.total ?? 0) > 0,
  };
  const steps = STEPS.map((step) => ({ ...step, done: done[step.key] }));
  return steps.some((step) => step.key !== "tour" && !step.done) ? steps.map((step) => (step.key === "tour" ? { ...step, done: false } : step)) : null;
}
