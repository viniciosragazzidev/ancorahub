import type { DealListRow } from "@/features/auto-sale/queries";

export const STATUS_TONE: Record<DealListRow["status"], "success" | "warning" | "info" | "secondary" | "outline"> = {
  active: "success", paused: "secondary", waiting_manager: "warning", handed_off: "info", won: "success", lost: "outline", cancelled: "outline",
};

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}
