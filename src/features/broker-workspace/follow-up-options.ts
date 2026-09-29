export type FollowUpOptionValue = "today" | "tomorrow" | "in_2_days" | "in_3_days" | "custom";

export const FOLLOW_UP_OPTIONS = {
  no_contact: [
    { value: "today", label: "Mais tarde" },
    { value: "tomorrow", label: "Amanhã" },
    { value: "in_2_days", label: "Em 2 dias" },
    { value: "custom", label: "Escolher data" },
  ],
  quote_sent: [
    { value: "tomorrow", label: "Amanhã" },
    { value: "in_2_days", label: "Em 2 dias" },
    { value: "in_3_days", label: "Em 3 dias" },
    { value: "custom", label: "Escolher data" },
  ],
} as const satisfies Record<"no_contact" | "quote_sent", ReadonlyArray<{ value: FollowUpOptionValue; label: string }>>;

/**
 * Converts the date-only value from the browser into a stable local-business
 * time. The server action also accepts the preset values directly.
 */
export function buildFollowUpWhen(option: FollowUpOptionValue, customDate: string): string | null {
  if (option !== "custom") return option;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate)) return null;
  return `${customDate}T09:00:00-03:00`;
}
