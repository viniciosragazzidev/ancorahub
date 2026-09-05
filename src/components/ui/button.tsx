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
      pressScale: _pressScale,
      children,
      ...restProps
    },
    ref,
  ) {
    const mergedClass = cn(buttonVariants({ variant, size }), className);

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
        >
          {React.cloneElement(render, renderOwnProps, children)}
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
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          data-slot="button"
          className={mergedClass}
          {...safeRestProps}
        >
          {children}
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
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
