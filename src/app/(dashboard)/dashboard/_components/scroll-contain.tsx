"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a vertically-scrollable area so that wheel events never leak to the
 * page scroll when the inner container is at its top or bottom boundary.
 *
 * Use it in place of a plain `<div>` with `overflow-y-auto`.
 */
export function ScrollContain({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop === 0;
    const atBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;

    // If scrolling up at top, or scrolling down at bottom → let page scroll.
    // Otherwise, consume the event so the page doesn't scroll.
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      // Already at boundary — don't block page scroll.
      return;
    }

    // Still has room to scroll internally — stop propagation to page.
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("overflow-y-auto overscroll-contain", className)}
      style={style}
      onWheel={handleWheel}
    >
      {children}
    </div>
  );
}
