"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const INSTANT_TRANSITION: Transition = { duration: 0 };
const CHEVRON_TRANSITION: Transition = { type: "spring", duration: 0.4, bounce: 0.3 };

const LIST_VARIANTS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -6, filter: "blur(3px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

type Placement = "bottom" | "top";

interface SelectContextValue {
  value: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  select: (value: string) => void;
  register: (value: string, label: ReactNode) => void;
  unregister: (value: string) => void;
  labelFor: (value: string | undefined) => ReactNode | undefined;
  reduce: boolean;
  triggerId: string;
  listId: string;
  disabled: boolean;
  placement: Placement;
  setPlacement: (p: Placement) => void;
  triggerElement: HTMLButtonElement | null;
  setTriggerElement: (element: HTMLButtonElement | null) => void;
  contentElement: HTMLDivElement | null;
  setContentElement: (element: HTMLDivElement | null) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error(`${component} must be used within <Select>`);
  return ctx;
}

export interface SelectProps<V extends string = string> {
  value?: V | null;
  defaultValue?: V;
  onValueChange?: (value: any) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  labels?: Record<string, ReactNode>;
  className?: string;
  children: ReactNode;
}

export function Select<V extends string = string>({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  required,
  name,
  labels: propLabels,
  className,
  children,
}: SelectProps<V>) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const [labels, setLabels] = useState<Map<string, ReactNode>>(new Map());
  const [placement, setPlacement] = useState<Placement>("bottom");
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(null);

  const controlled = value !== undefined;
  const current = controlled ? (value ?? undefined) : internal;

  const select = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
      setOpen(false);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((v: string, label: ReactNode) => {
    setLabels((m) => (m.get(v) === label ? m : new Map(m).set(v, label)));
  }, []);

  const unregister = useCallback((v: string) => {
    setLabels((m) => {
      if (!m.has(v)) return m;
      const next = new Map(m);
      next.delete(v);
      return next;
    });
  }, []);

  useEffect(() => {
    if (propLabels) {
      for (const [k, v] of Object.entries(propLabels)) {
        register(k, v);
      }
    }
  }, [propLabels, register]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !contentElement?.contains(target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, contentElement]);

  const ctx = useMemo<SelectContextValue>(
    () => ({
      value: current,
      open,
      setOpen,
      select,
      register,
      unregister,
      labelFor: (v) => (v === undefined ? undefined : labels.get(v)),
      reduce,
      triggerId: `${baseId}-trigger`,
      listId: `${baseId}-list`,
      disabled,
      placement,
      setPlacement,
      triggerElement,
      setTriggerElement,
      contentElement,
      setContentElement,
    }),
    [
      current,
      open,
      select,
      register,
      unregister,
      labels,
      reduce,
      baseId,
      disabled,
      placement,
      triggerElement,
      contentElement,
    ],
  );

  return (
    <SelectContext.Provider value={ctx}>
      <div ref={rootRef} className={cn("relative inline-block w-full", className)}>
        {name ? <input type="hidden" name={name} value={current ?? ""} required={required} /> : null}
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps {
  className?: string;
  children: ReactNode;
  id?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  "aria-label"?: string;
}

export function SelectTrigger({
  className,
  children,
  id,
  size = "default",
  disabled,
  "aria-label": ariaLabel,
}: SelectTriggerProps) {
  const ctx = useSelectContext("SelectTrigger");
  const isTop = ctx.placement === "top";
  const isDisabled = disabled ?? ctx.disabled;

  const kf = ctx.open ? [0, 0, 10] : [10, 0, 10];
  const kfT: Transition = ctx.reduce
    ? { duration: 0 }
    : ctx.open
      ? { duration: 0.6, times: [0, 0.4, 1], ease: EASE_OUT }
      : { duration: 0.42, times: [0, 0.5, 1], ease: EASE_OUT };

  return (
    <motion.button
      ref={ctx.setTriggerElement}
      type="button"
      id={id ?? ctx.triggerId}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      aria-controls={ctx.listId}
      onClick={() => ctx.setOpen(!ctx.open)}
      initial={false}
      animate={{
        borderTopLeftRadius: isTop ? kf : 10,
        borderTopRightRadius: isTop ? kf : 10,
        borderBottomLeftRadius: isTop ? 10 : kf,
        borderBottomRightRadius: isTop ? 10 : kf,
      }}
      transition={{
        borderTopLeftRadius: isTop ? kfT : INSTANT_TRANSITION,
        borderTopRightRadius: isTop ? kfT : INSTANT_TRANSITION,
        borderBottomLeftRadius: isTop ? INSTANT_TRANSITION : kfT,
        borderBottomRightRadius: isTop ? INSTANT_TRANSITION : kfT,
      }}
      className={cn(
        "relative z-10 flex w-full items-center justify-between gap-2 rounded-[10px] border border-input bg-card px-3 text-foreground outline-none transition-colors select-none",
        "hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 py-1 text-xs" : "h-9 py-2 text-sm",
        className,
      )}
    >
      {children}
      <motion.span
        aria-hidden
        animate={{ rotate: ctx.open ? 180 : 0 }}
        transition={ctx.reduce ? { duration: 0 } : CHEVRON_TRANSITION}
        className="text-muted-foreground shrink-0"
      >
        <ChevronDown className="h-4 w-4" />
      </motion.span>
    </motion.button>
  );
}

export interface SelectValueProps {
  placeholder?: ReactNode;
  className?: string;
  children?: ReactNode | ((value: string | null) => ReactNode);
}

export function SelectValue({ placeholder, className, children }: SelectValueProps) {
  const ctx = useSelectContext("SelectValue");
  const label = ctx.labelFor(ctx.value);

  let renderedContent: ReactNode;
  if (typeof children === "function") {
    renderedContent = children(ctx.value ?? null);
  } else if (children !== undefined && children !== null) {
    renderedContent = children;
  } else {
    renderedContent = label ?? placeholder ?? "Selecione...";
  }

  const isPlaceholder =
    (ctx.value === undefined || ctx.value === null || ctx.value === "") &&
    label === undefined;

  return (
    <span
      className={cn(
        "truncate text-left flex-1",
        isPlaceholder ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {renderedContent}
    </span>
  );
}

export interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

export function SelectContent({ className, children }: SelectContentProps) {
  const ctx = useSelectContext("SelectContent");
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const open = ctx.open;
  const { setPlacement } = ctx;

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const trigger = ctx.triggerElement;
    const node = innerRef.current;
    if (!trigger || !node) return;

    const rect = trigger.getBoundingClientRect();
    const dropdownHeight = node.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const nextPlacement: Placement = below < dropdownHeight + 16 && above > below ? "top" : "bottom";
    const width = Math.min(rect.width, Math.max(0, window.innerWidth - 16));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));

    setPlacement(nextPlacement);
    setPosition({
      left,
      top: nextPlacement === "top" ? Math.max(8, rect.top - dropdownHeight - 6) : rect.bottom + 6,
      width,
    });
  }, [ctx.triggerElement, setPlacement]);

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setHeight(node.offsetHeight);
      updatePosition();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const isTop = ctx.placement === "top";
  const nearRadius = open ? 12 : 0;
  const radiusT: Transition = open
    ? { duration: 0.3, ease: EASE_OUT, delay: 0.14 }
    : { duration: 0.16, ease: EASE_OUT };

  if (!mounted) return null;

  return createPortal(
    <motion.div
      ref={ctx.setContentElement}
      id={ctx.listId}
      role="listbox"
      aria-labelledby={ctx.triggerElement?.id ?? ctx.triggerId}
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={
        ctx.reduce
          ? { opacity: open ? 1 : 0, height: open ? height : 0 }
          : {
              opacity: open ? 1 : 0,
              height: open ? height : 0,
              borderTopLeftRadius: isTop ? 12 : nearRadius,
              borderTopRightRadius: isTop ? 12 : nearRadius,
              borderBottomLeftRadius: isTop ? nearRadius : 12,
              borderBottomRightRadius: isTop ? nearRadius : 12,
            }
      }
      transition={
        ctx.reduce
          ? { duration: 0.12 }
          : {
              opacity: open
                ? { duration: 0.18 }
                : { duration: 0.16, delay: 0.12 },
              height: open
                ? { type: "spring", duration: 0.42, bounce: 0.14 }
                : { duration: 0.26, ease: EASE_OUT, delay: 0.14 },
              borderTopLeftRadius: isTop ? INSTANT_TRANSITION : radiusT,
              borderTopRightRadius: isTop ? INSTANT_TRANSITION : radiusT,
              borderBottomLeftRadius: isTop ? radiusT : INSTANT_TRANSITION,
              borderBottomRightRadius: isTop ? radiusT : INSTANT_TRANSITION,
            }
      }
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: position.width,
        zIndex: 100,
        transformOrigin: isTop ? "bottom" : "top",
        overflow: "hidden",
        pointerEvents: open ? "auto" : "none",
      }}
      className={cn(
        "max-h-60 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
        className,
      )}
    >
      <motion.div
        ref={innerRef}
        variants={ctx.reduce ? undefined : LIST_VARIANTS}
        initial={false}
        animate={open ? "show" : "hidden"}
        className="p-1"
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export interface SelectItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function SelectItem({
  value,
  disabled = false,
  className,
  children,
}: SelectItemProps) {
  const ctx = useSelectContext("SelectItem");
  const selected = ctx.value === value;

  useLayoutEffect(() => {
    ctx.register(value, children);
    return () => ctx.unregister(value);
  }, [ctx.register, ctx.unregister, value, children]);

  return (
    <motion.li variants={ctx.reduce ? undefined : ITEM_VARIANTS} className="list-none">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        onClick={() => ctx.select(value)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors cursor-pointer select-none",
          selected
            ? "bg-accent text-accent-foreground font-medium"
            : "text-popover-foreground hover:bg-accent/50 focus-visible:bg-accent/50",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        <span className="truncate flex-1">{children}</span>
        {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
      </button>
    </motion.li>
  );
}
