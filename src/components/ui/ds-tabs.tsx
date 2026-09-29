"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/utils/core/cn";

/**
 * Tabs — docs/design-system.md § Tabs.
 * Bar: Canvas White with a 1px Ash bottom border. Inactive: 14px Fog. Active:
 * Charcoal, Inter 600. Indicator: 2px Electric Blue underline with 9999px caps.
 * Hover darkens the text only (no fill). Padding 12px/16px per tab.
 *
 * Re-skins @base-ui/react/tabs, which already provides roving focus, arrow-key
 * navigation and the tab/panel ARIA wiring.
 */
const DsTabs = TabsPrimitive.Root;

function DsTabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="ds-tabs-list"
      className={cn(
        "relative flex w-full items-center gap-ds-4 overflow-x-auto border-b border-ds-ash bg-ds-canvas-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        data-slot="ds-tabs-indicator"
        className="pointer-events-none absolute bottom-0 left-(--active-tab-left) h-0.5 w-(--active-tab-width) rounded-full bg-ds-electric-blue transition-[left,width] duration-200 ease-out motion-reduce:transition-none"
      />
    </TabsPrimitive.List>
  );
}

export interface DsTabsTriggerProps extends TabsPrimitive.Tab.Props {
  icon?: React.ReactNode;
  /** Pending-work counter shown as a quiet pill; hidden when 0/undefined. */
  count?: number;
}

function DsTabsTrigger({ className, icon, count, children, ...props }: DsTabsTriggerProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="ds-tabs-trigger"
      className={cn(
        "flex min-h-ds-48 shrink-0 cursor-pointer items-center gap-ds-8 whitespace-nowrap px-ds-16 py-ds-12 font-ds-inter text-ds-body text-ds-fog outline-none transition-colors duration-150 hover:text-ds-charcoal focus-visible:rounded-ds-buttons focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40 data-active:font-semibold data-active:text-ds-charcoal disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {icon ? <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">{icon}</span> : null}
      {children}
      {count ? (
        <span className="rounded-ds-tags bg-ds-paper-mist px-ds-8 py-px font-ds-inter text-ds-caption font-medium tabular-nums text-ds-steel">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </TabsPrimitive.Tab>
  );
}

function DsTabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="ds-tabs-panel"
      className={cn("pt-ds-24 outline-none", className)}
      {...props}
    />
  );
}

export { DsTabs, DsTabsList, DsTabsTrigger, DsTabsPanel };
