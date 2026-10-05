"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariants } from "./button-variants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NativeButtonProps = React.ComponentPropsWithoutRef<"button">;

export interface ButtonProps extends NativeButtonProps, ButtonVariants {
  /** Shows a spinner without changing the button's width. */
  loading?: boolean;
  /**
   * Render the button as a different element (e.g. Next.js <Link>).
   * The render element receives the button's className, onClick and children.
   * Compatible with the @base-ui `render` prop pattern.
   */
  render?: React.ReactElement<Record<string, unknown>>;
  /** Use Radix asChild pattern instead of render prop. */
  asChild?: boolean;
  /** @deprecated A interação pressionada é definida pelo CSS canônico. */
  pressScale?: number;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "default",
      size = "default",
      render,
      asChild = false,
      loading = false,
      pressScale: _pressScale,
      children,
      ...restProps
    },
    ref,
  ) {
    const mergedClass = cn(buttonVariants({ variant, size }), loading && "pointer-events-none", className);
    const loadingContent = (label: React.ReactNode) => {
      const parts = React.Children.toArray(label);
      const iconIndex = parts.findIndex(
        (part) => React.isValidElement(part) && (
          part.type === "svg" ||
          "data-icon" in (part.props as object) ||
          /(?:HugeIcon|Icon)$/.test((part.type as { displayName?: string }).displayName ?? "")
        ),
      );
      if (iconIndex >= 0) {
        return parts.map((part, index) => index === iconIndex ? (
          <span key="loading-icon" className="relative inline-grid place-items-center">
            <span className="opacity-0">{part}</span>
            <span className="ct-spinner absolute" aria-hidden="true" />
          </span>
        ) : part);
      }
      return (
        <span className="relative inline-grid place-items-center">
          <span className="opacity-0">{label}</span>
          <span className="ct-spinner absolute" aria-hidden="true" />
        </span>
      );
    };
    const content = loading ? loadingContent(children) : children;

    // -------------------------------------------------------------------------
    // render-prop path  →  <Button render={<Link href="/..." />}>label</Button>
    // -------------------------------------------------------------------------
    if (render && React.isValidElement(render)) {
      // Strip className from the render element — the merged one wins.
      // Strip `type` so native button type="button" doesn't land on <a>.
      const { className: _rc, type: _rt, ...renderOwnProps } = render.props as {
        className?: string;
        type?: string;
        [key: string]: unknown;
      };

      // restProps may contain `type` (default "button") — must not reach Link.
      const { type: _bt, ...safeRestProps } = restProps as {
        type?: string;
        [key: string]: unknown;
      };

      // Slot merges safeRestProps (onClick, disabled, aria-*, data-*, …) onto
      // the render element and styles the resulting DOM node.
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          data-slot="button"
          className={mergedClass}
          {...safeRestProps}
          aria-busy={loading || restProps["aria-busy"]}
          aria-disabled={loading || restProps["aria-disabled"]}
          tabIndex={loading ? -1 : restProps.tabIndex}
        >
          {React.cloneElement(render, renderOwnProps, content)}
        </Slot>
      );
    }

    // -------------------------------------------------------------------------
    // asChild path  →  <Button asChild><Link href="/...">label</Link></Button>
    // -------------------------------------------------------------------------
    if (asChild) {
      const { type: _bt, ...safeRestProps } = restProps as {
        type?: string;
        [key: string]: unknown;
      };
      const child = React.Children.only(children) as React.ReactElement<{ children?: React.ReactNode }>;
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          data-slot="button"
          className={mergedClass}
          {...safeRestProps}
          aria-busy={loading || restProps["aria-busy"]}
          aria-disabled={loading || restProps["aria-disabled"]}
          tabIndex={loading ? -1 : restProps.tabIndex}
        >
          {loading
            ? React.cloneElement(child, undefined, loadingContent(child.props.children))
            : child}
        </Slot>
      );
    }

    // -------------------------------------------------------------------------
    // Native button (default path)
    // -------------------------------------------------------------------------
    return (
      <button
        ref={ref}
        data-slot="button"
        type={
          (restProps as React.ButtonHTMLAttributes<HTMLButtonElement>).type ??
          "button"
        }
        className={mergedClass}
        {...restProps}
        disabled={loading || restProps.disabled}
        aria-busy={loading || restProps["aria-busy"]}
      >
        {content}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
