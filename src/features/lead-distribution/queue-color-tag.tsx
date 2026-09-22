import { queueHueToDotColor } from "./queue-color";

/**
 * The 8px dot used everywhere a queue's color shows up: leads table, kanban
 * card, lead drawer, queue settings. Same dot+caption shape as a chart
 * legend — never a colored background — so a queue's color stays the single
 * chromatic accent in whatever row or card it sits in.
 */
export function QueueColorDot({ hue, className }: { hue: number | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="queue-color-dot"
      className={className ? `inline-block size-2 shrink-0 rounded-full ${className}` : "inline-block size-2 shrink-0 rounded-full"}
      style={{ backgroundColor: queueHueToDotColor(hue) }}
    />
  );
}

/** Dot + queue name, for places that show which queue a lead belongs to. */
export function QueueColorTag({
  name,
  hue,
  className,
}: {
  name: string | null | undefined;
  hue: number | null | undefined;
  className?: string;
}) {
  if (!name) return <span className="text-xs text-muted-foreground/70 italic">Sem fila</span>;
  return (
    <span className={className ? `inline-flex min-w-0 items-center gap-1.5 ${className}` : "inline-flex min-w-0 items-center gap-1.5"}>
      <QueueColorDot hue={hue} />
      <span className="truncate text-xs font-medium text-foreground" title={name}>
        {name}
      </span>
    </span>
  );
}
