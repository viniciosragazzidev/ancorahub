import * as React from "react";
import { cn } from "@/utils/core/cn";

export interface DsSidebarNavItemProps
  extends React.ComponentPropsWithoutRef<"a"> {
  active?: boolean;
  icon?: React.ReactNode;
}

/**
 * Sidebar Nav Item — docs/design-system.md § Components.
 * Transparent or light-blue (#dbeaff) active background, 8px radius,
 * #171717 text. Active state uses a soft chromatic fill instead of a bold
 * left-border indicator — do not add a border-left affordance here.
 */
export const DsSidebarNavItem = React.forwardRef<
  HTMLAnchorElement,
  DsSidebarNavItemProps
>(function DsSidebarNavItem(
  { className, children, active = false, icon, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      data-slot="ds-sidebar-nav-item"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-ds-8 rounded-ds-buttons border-0 px-ds-8 py-ds-12 font-ds-inter text-ds-body text-ds-charcoal no-underline transition-colors duration-150 ease-out hover:bg-ds-paper-mist",
        active ? "bg-ds-powder-blue hover:bg-ds-powder-blue" : "bg-transparent",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </a>
  );
});
