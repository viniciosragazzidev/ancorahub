/**
 * Item 7 do plano: leads entregues nas últimas 24 h ainda sem primeiro contato e o prazo mais próximo.
 * Prazo = `sla_first_contact_minutes` + `feedback_grace_minutes` do tenant (o mesmo da varredura feedback-sla.ts),
 * que roda a cada 5 min e só em horário comercial (8 h às 18 h, dias úteis, São Paulo).
 */
import { isWithinBusinessHours, scheduleForBusinessHours } from "@/shared/time/business-hours";

import { plural } from "../copy";
import type { LiveScope, LiveStatus } from "../types";

export type FirstContactSettings = { firstContactMinutes: number; graceMinutes: number };

export function buildFirstContactStatus(input: { assignedAt: readonly Date[]; settings: FirstContactSettings; now: Date; scope: Pick<LiveScope, "role"> }): LiveStatus {
  const { now, settings, scope } = input;
  const limitMs = (settings.firstContactMinutes + settings.graceMinutes) * 60_000;
  const pending = input.assignedAt.filter((at) => at.getTime() + limitMs > now.getTime());
  const late = input.assignedAt.length - pending.length;
  const firstPending = pending.reduce<Date | null>((best, at) => (!best || at < best ? at : best), null);
  const own = scope.role === "broker";
  const total = input.assignedAt.length;
  const base: LiveStatus = {
    id: "primeiro-contato",
    label: own ? "Seus leads sem primeiro contato" : "Sem primeiro contato",
    value: total,
    emptyText: own ? "Você está em dia com os primeiros contatos" : "Todos os leads de hoje já tiveram contato",
    severity: late ? "atencao" : total ? "info" : "ok",
    explanation: own
      ? `Fale com o cliente em até ${settings.firstContactMinutes} min; depois de ${settings.graceMinutes} min de tolerância, a gestão recebe o alerta.`
      : `Prazo de ${settings.firstContactMinutes} min mais ${settings.graceMinutes} de tolerância. Depois disso, gestor e diretor recebem o alerta.`,
    breakdown: total ? [{ label: "no prazo", value: pending.length }, { label: "atrasados", value: late }] : undefined,
    action: { href: own ? "/minha-fila" : "/leads", label: own ? "Responder" : "Leads" },
    generatedAt: now.toISOString(),
  };
  if (!total) return base;
  if (!isWithinBusinessHours(now)) {
    return { ...base, nextEvent: { at: scheduleForBusinessHours(now).toISOString(), label: "Fora do horário comercial; a cobrança volta", dueLabel: "Cobrança retomada" } };
  }
  if (!firstPending) return { ...base, note: `${plural(late, "lead passou", "leads passaram")} do prazo.` };
  const deadline = new Date(firstPending.getTime() + limitMs);
  return {
    ...base,
    nextEvent: {
      at: deadline.toISOString(),
      label: own ? "O prazo do próximo estoura" : "O mais próximo estoura",
      windowStartAt: firstPending.toISOString(),
      dueLabel: "Prazo estourado",
    },
  };
}
