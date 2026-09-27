import type { TeamNotice, TeamNoticeSetting } from "./catalog";

/** The company WAHA number as the decision sees it. */
export type CompanyNumberState = { id: string; connected: boolean; pausedUntil: Date | null } | null;

export type NoticeDecision =
  | { action: "skip"; reason: "disabled" }
  | {
      action: "send";
      /** Where it goes first. */
      primary: "company_number" | "meta";
      /** Company number used first, or as the fallback when Meta cannot send. */
      wahaNumberId: string | null;
      /** Why the preferred company number was not used, when it was the preference. */
      note: "company_number_unavailable" | "company_number_paused" | null;
    };

export function companyNumberUsable(number: CompanyNumberState, now: Date) {
  if (!number || !number.connected) return { usable: false as const, why: "company_number_unavailable" as const };
  if (number.pausedUntil && number.pausedUntil.getTime() > now.getTime()) return { usable: false as const, why: "company_number_paused" as const };
  return { usable: true as const, why: null };
}

/**
 * One decision per team notice (DEC-125). Disabled means "do not send": it is
 * never turned into another channel. Company number first falls back to Meta;
 * Meta first keeps the company number as the fallback for a Meta template the
 * sending number does not have.
 */
export function decideTeamNotice(notice: TeamNotice, setting: TeamNoticeSetting, number: CompanyNumberState, now: Date): NoticeDecision {
  if (!setting.enabled) return { action: "skip", reason: "disabled" };
  const company = companyNumberUsable(number, now);
  if (notice.metaOnly) return { action: "send", primary: "meta", wahaNumberId: null, note: null };
  if (setting.channel === "company_number") {
    return company.usable
      ? { action: "send", primary: "company_number", wahaNumberId: number!.id, note: null }
      : { action: "send", primary: "meta", wahaNumberId: null, note: company.why };
  }
  return { action: "send", primary: "meta", wahaNumberId: company.usable ? number!.id : null, note: null };
}
