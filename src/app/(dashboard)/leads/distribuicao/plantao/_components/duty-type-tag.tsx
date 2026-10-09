import { queueHueToDotColor } from "@/features/lead-distribution/queue-color";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { cn } from "@/lib/utils";

/** Pure display helpers of plantão types (no server actions, safe anywhere). */
export const MODALITY_LABEL = { online: "Online", presencial: "Presencial" } as const;

export function typeColor(hue: number | null | undefined) {
  return queueHueToDotColor(hue);
}

/** "Todas as unidades" or the names of the type's units. */
export function typeUnitsLabel(type: { branchIds: readonly string[] }, branches: ReadonlyArray<{ id: string; name: string }>) {
  if (!type.branchIds.length) return "Todas as unidades";
  const names = type.branchIds.map((id) => branches.find((branch) => branch.id === id)?.name).filter(Boolean) as string[];
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ") || "Unidades removidas";
}

/** Dot + type name: the type's color is the single accent where it shows. */
export function DutyTypeTag({ name, hue, className }: { name: string | null | undefined; hue: number | null | undefined; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <QueueColorDot hue={name ? hue : null} />
      <span className="truncate text-xs font-medium" title={name ?? "Sem tipo"}>{name ?? "Sem tipo"}</span>
    </span>
  );
}

/** Inline style for the left color stripe of a plantão chip/card. */
export function typeStripe(hue: number | null | undefined) {
  return { borderLeftColor: typeColor(hue), borderLeftWidth: 3 } as const;
}
