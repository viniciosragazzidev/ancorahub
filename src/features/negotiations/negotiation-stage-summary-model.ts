import type { NegotiationLead } from "./queries";
import type { NegotiationLevel } from "./negotiation-model";

function dayKeyInTimezone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Leads currently at `level` whose current CRM stage began on the operational date in São Paulo. */
export function enteredToday(leads: readonly NegotiationLead[], level: NegotiationLevel, now: Date) {
  const today = dayKeyInTimezone(now, "America/Sao_Paulo");
  return leads.reduce((total, lead) => {
    if (lead.level !== level || !lead.stageEnteredAt) return total;
    const enteredAt = new Date(lead.stageEnteredAt);
    if (!Number.isFinite(enteredAt.getTime())) return total;
    return total + Number(dayKeyInTimezone(enteredAt, "America/Sao_Paulo") === today);
  }, 0);
}
