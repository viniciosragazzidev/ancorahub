import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";

import type { LeadTag } from "../rules";

/**
 * A lead tag: pill with a colored dot and the name. The color is only the
 * dot (like queues), so the tag stays a single accent in any row or card.
 */
export function LeadTagChip({ tag, className }: { tag: Pick<LeadTag, "name" | "colorHue">; className?: string }) {
  return (
    <span
      className={`inline-flex max-w-[10rem] items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10px] font-medium text-foreground ${className ?? ""}`}
      title={tag.name}
    >
      <QueueColorDot hue={tag.colorHue} className="size-1.5" />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** A lead's tags in a row (lists): the first few, then "+N". */
export function LeadTagChips({ tags, max = 3, className }: { tags: readonly LeadTag[] | undefined; max?: number; className?: string }) {
  if (!tags?.length) return null;
  const shown = tags.slice(0, max);
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-1 ${className ?? ""}`}>
      {shown.map((tag) => <LeadTagChip key={tag.id} tag={tag} />)}
      {tags.length > max ? <span className="text-[10px] text-muted-foreground">+{tags.length - max}</span> : null}
    </span>
  );
}
