import * as React from "react";
import { cn } from "@/utils/core/cn";

/**
 * Data List / Row — docs/design-system.md § Dashboard Table Row + Dashboard Card.
 * The one way to show "a list of things" (leads, queues, rules, duties):
 * a single bordered card with a row per item, instead of one nested card per
 * item. Rows are separated by 1px Ash lines, 16px vertical padding (≈48px real
 * height), and a Paper Mist hover fill when the row is clickable.
 */
export function DsDataList({ className, ...props }: React.ComponentPropsWithoutRef<"ul">) {
  return (
    <ul
      data-slot="ds-data-list"
      className={cn(
        "divide-y divide-ds-ash overflow-hidden rounded-ds-cards border border-ds-ash bg-ds-canvas-white p-0",
        className,
      )}
      {...props}
    />
  );
}

export interface DsDataRowProps extends Omit<React.ComponentPropsWithoutRef<"li">, "title"> {
  /** Leading slot: checkbox, avatar or a status badge. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** One quiet line of supporting text under the title. */
  description?: React.ReactNode;
  /** Neutral attribute chips (source, unit, mode) — never chromatic. */
  meta?: React.ReactNode;
  /** Trailing slot: ONE primary row action plus an optional `•••` menu. */
  actions?: React.ReactNode;
  /** Makes the whole row a hover target (pair with an inner link/button for the action). */
  interactive?: boolean;
  /** Position in the list: rows rise in one after another (first 8 only). Omit to skip the entrance. */
  index?: number;
}

export function DsDataRow({ leading, title, description, meta, actions, interactive, index, className, style, ...props }: DsDataRowProps) {
  return (
    <li
      data-slot="ds-data-row"
      style={index === undefined ? style : ({ ...style, "--ds-i": index } as React.CSSProperties)}
      className={cn(
        index !== undefined && "ds-rise",
        "flex flex-col gap-ds-12 px-ds-16 py-ds-16 font-ds-inter text-ds-body text-ds-charcoal sm:flex-row sm:items-center sm:justify-between",
        interactive && "transition-colors duration-150 hover:bg-ds-paper-mist",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-ds-12">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          {description ? <p className="truncate text-ds-caption text-ds-fog">{description}</p> : null}
          {meta ? <div className="mt-ds-4 flex flex-wrap items-center gap-ds-4">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-ds-8 self-start sm:self-auto">{actions}</div> : null}
    </li>
  );
}

/** Neutral attribute chip: icon + text on Paper Mist, so attributes never compete with the status badge. */
export function DsMetaChip({ icon, className, children, ...props }: React.ComponentPropsWithoutRef<"span"> & { icon?: React.ReactNode }) {
  return (
    <span
      data-slot="ds-meta-chip"
      className={cn(
        "inline-flex items-center gap-ds-4 rounded-ds-tags bg-ds-paper-mist px-ds-8 py-px font-ds-inter text-ds-caption text-ds-steel",
        className,
      )}
      {...props}
    >
      {icon ? <span aria-hidden="true" className="flex size-3 items-center justify-center">{icon}</span> : null}
      {children}
    </span>
  );
}
