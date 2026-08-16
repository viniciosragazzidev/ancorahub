"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";
import { motion, MotionConfig, useReducedMotion, type Transition } from "motion/react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Variant = "pill" | "underline" | "segment" | "line";

type TabsCtxValue = {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
  variant: Variant;
};

type CleanDivProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
>;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TabsCtx = createContext<TabsCtxValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tabs.* deve ser usado dentro de <Tabs>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Spring transition — indicador se move com vida, sem snap brusco
// ---------------------------------------------------------------------------

const springTransition: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 1.2,
};

// ---------------------------------------------------------------------------
// Tabs (root)
// ---------------------------------------------------------------------------

function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = "underline",
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value! : internal;

  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );

  const contextValue = useMemo<TabsCtxValue>(
    () => ({ value: current, setValue, layoutId, variant }),
    [current, layoutId, setValue, variant],
  );

  return (
    <MotionConfig transition={reduce ? { duration: 0 } : springTransition}>
      <TabsCtx.Provider value={contextValue}>
        <motion.div layoutRoot className={cn("flex flex-col gap-2", className)}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
}

// ---------------------------------------------------------------------------
// TabsList
// ---------------------------------------------------------------------------

const listClasses: Record<Variant, string> = {
  pill: "inline-flex items-center gap-1 rounded-full bg-card p-1",
  underline:
    "inline-flex w-full items-center gap-1 overflow-x-auto border-b border-border bg-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  line:
    "inline-flex w-full items-center gap-1 overflow-x-auto border-b border-border bg-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  segment: "inline-flex items-center gap-0 rounded-lg bg-muted/40 p-0.5",
};

function TabsList({
  children,
  className,
  variant: propVariant,
  ...props
}: CleanDivProps & {
  variant?: Variant;
}) {
  const ctx = useContext(TabsCtx);
  const variant = propVariant ?? ctx?.variant ?? "underline";
  return (
    <div role="tablist" className={cn(listClasses[variant], className)} {...props}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabsTrigger
// ---------------------------------------------------------------------------

function TabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
  disabled,
  onClick,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "onAnimationStart" | "onDrag"> & {
  value: string;
  indicatorClassName?: string;
}) {
  const { value: current, setValue, layoutId, variant } = useTabs();
  const active = current === value;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      setValue(value);
    }
  };

  if (variant === "underline" || variant === "line") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative isolate inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-2 pb-2.5 pt-2 text-sm font-medium outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
        {active && (
          <motion.span
            layoutId={layoutId}
            className={cn(
              "absolute -bottom-px left-0 right-0 h-0.5 bg-primary",
              indicatorClassName,
            )}
          />
        )}
      </button>
    );
  }

  const radius = variant === "pill" ? "rounded-full" : "rounded-md";

  return (
    <div className="relative">
      {active && (
        <motion.span
          layoutId={layoutId}
          style={{ borderRadius: variant === "pill" ? 9999 : 8 }}
          className={cn(
            "absolute inset-0 bg-primary",
            radius,
            indicatorClassName,
          )}
        />
      )}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative z-10 inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap bg-transparent px-3.5 py-1.5 text-sm font-medium outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          radius,
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabsContent
// ---------------------------------------------------------------------------

function TabsContent({
  value,
  children,
  className,
  ...props
}: CleanDivProps & {
  value: string;
}) {
  const { value: current } = useTabs();
  const reduce = useReducedMotion();
  const active = current === value;

  if (!active) {
    return (
      <div hidden className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { Variant as TabsVariant };
