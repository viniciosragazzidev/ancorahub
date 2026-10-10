"use client";

import { useInterfaceReducedMotion as useReducedMotion } from "@/components/motion/interface-motion-provider";

import * as React from "react";
import { motion } from "motion/react";
import { transitions } from "@/lib/motion";
import { cn } from "@/utils/core/cn";

export interface DsSegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Optional counter (e.g. pending items in this filter). */
  count?: number;
  disabled?: boolean;
}

export interface DsSegmentedControlProps<T extends string = string>
  extends Omit<React.ComponentPropsWithoutRef<"div">, "onChange" | "defaultValue"> {
  options: readonly DsSegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name for the group; required because there is no visible label. */
  "aria-label": string;
}

/**
 * Segmented Control — docs/design-system.md § Segmented Control.
 * Track: Paper Mist, 8px radius, 1px Ash border, 2px inner padding.
 * Unselected: Fog text. Selected: white pill (6px radius, nested in the 8px
 * track), Charcoal text, --shadow-subtle. Segment padding 8px/12px.
 *
 * Implemented as a radiogroup: arrow keys move the selection, Home/End jump.
 * The selected white pill glides between segments (a shared-layout spring); with
 * reduced motion it snaps instead.
 */
export function DsSegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  className,
  ...props
}: DsSegmentedControlProps<T>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const pillId = React.useId();
  const reduce = useReducedMotion();
  const enabled = options.filter((option) => !option.disabled);

  function move(delta: number, from: number) {
    if (!enabled.length) return;
    const currentEnabled = enabled.findIndex((option) => option.value === options[from]?.value);
    const next = enabled[(currentEnabled + delta + enabled.length) % enabled.length];
    onValueChange(next.value);
    refs.current[options.findIndex((option) => option.value === next.value)]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); move(1, index); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); move(-1, index); }
    else if (event.key === "Home") { event.preventDefault(); onValueChange(enabled[0].value); refs.current[options.findIndex((o) => o.value === enabled[0].value)]?.focus(); }
    else if (event.key === "End") { event.preventDefault(); const last = enabled[enabled.length - 1]; onValueChange(last.value); refs.current[options.findIndex((o) => o.value === last.value)]?.focus(); }
  }

  return (
    <div
      role="radiogroup"
      data-slot="ds-segmented-control"
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-muted p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "relative flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40 disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "font-medium text-ds-charcoal" : "text-ds-fog hover:text-ds-charcoal",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={reduce ? undefined : pillId}
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-border bg-card shadow-[var(--shadow-xs)]"
                transition={reduce ? { duration: 0 } : transitions.normal}
              />
            ) : null}
            <span className="relative">{option.label}</span>
            {option.count ? (
              <span className={cn("relative rounded-ds-tags px-ds-8 py-px text-ds-caption font-medium tabular-nums transition-colors duration-150", selected ? "bg-ds-paper-mist text-ds-steel" : "bg-ds-canvas-white text-ds-fog")}>
                {option.count > 99 ? "99+" : option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
