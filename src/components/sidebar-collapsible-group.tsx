"use client";

import { useState, type ReactNode, type ComponentType, type SVGProps } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ChevronDownIcon } from "@/components/huge-icons";
import { SidebarGroup, SidebarGroupContent, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { weight?: string; className?: string }>;

export function SidebarCollapsibleGroup({
  label,
  icon: Icon,
  defaultOpen = true,
  children,
  className,
  headerClassName,
}: {
  label: string;
  icon?: IconComponent;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const showContent = isOpen || isCollapsed;

  return (
    <SidebarGroup className={cn("group/collapsible py-1", className)}>
      {/* Collapsed state (icon mode) */}
      <div
        className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-1 py-1.5 px-1"
        aria-hidden="true"
      >
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-accent/40 text-sidebar-foreground/70">
            <Icon className="size-4 shrink-0" />
          </div>
        )}
      </div>

      {/* Expanded state: Real interactive header item */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-semibold text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden",
          headerClassName,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="size-4 shrink-0 text-sidebar-foreground/65" />}
          <span className="truncate tracking-tight">{label}</span>
        </div>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 ease-out",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>

      {/* Content */}
      {isCollapsed ? (
        <SidebarGroupContent>{children}</SidebarGroupContent>
      ) : (
        <AnimatePresence initial={false}>
          {showContent && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden pt-1"
            >
              <SidebarGroupContent>{children}</SidebarGroupContent>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </SidebarGroup>
  );
}
