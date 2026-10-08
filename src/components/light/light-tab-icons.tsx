import { Ellipsis, House, ListChecks, MessageSquareText, type LucideIcon } from "lucide-react";

import type { LightTabId } from "./light-routes";

export const LIGHT_TAB_ICONS: Record<LightTabId, LucideIcon> = {
  inicio: House,
  fila: ListChecks,
  insights: MessageSquareText,
  mais: Ellipsis,
};

export function formatQueueBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}
