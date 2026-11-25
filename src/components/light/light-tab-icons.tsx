import { DotsIcon, HouseIcon, ListChecksIcon, MessageSquareIcon, type MarkerIconProps } from "@/components/icons/marker-icons";

import type { LightTabId } from "./light-routes";

// Ícones de marcador (25/11/2026), desenhados com a skill draw-icons.
export const LIGHT_TAB_ICONS: Record<LightTabId, (props: MarkerIconProps) => React.ReactElement> = {
  inicio: HouseIcon,
  fila: ListChecksIcon,
  insights: MessageSquareIcon,
  mais: DotsIcon,
};

export function formatQueueBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}
