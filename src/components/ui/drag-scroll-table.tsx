"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Movement (px) before a press becomes a drag, so plain clicks and text selection keep working. */
const DRAG_THRESHOLD = 4;
const INTERACTIVE = "a, button, input, select, textarea, [role=button]";

/**
 * Mouse drag scrolls the element sideways; touch and trackpads keep their
 * native scrolling. Returns the cleanup. With `startOnInteractive`, a drag may
 * start over a button (a strip made only of buttons, like tabs): a plain click
 * still clicks, a drag never does.
 */
export function attachDragScroll(container: HTMLElement, options: { startOnInteractive?: boolean } = {}) {
  const syncScrollable = () => {
    container.dataset.dragScroll = container.scrollWidth > container.clientWidth ? "idle" : "off";
  };
  syncScrollable();
  const resizeObserver = new ResizeObserver(syncScrollable);
  resizeObserver.observe(container);
  // The content can grow without the container resizing (more tabs, columns).
  if (container.firstElementChild) resizeObserver.observe(container.firstElementChild);

  let startX = 0;
  let startScroll = 0;
  let pointerId: number | null = null;
  let dragging = false;

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    syncScrollable();
    if (container.dataset.dragScroll === "off") return;
    if (!options.startOnInteractive && (event.target as Element).closest(INTERACTIVE)) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = container.scrollLeft;
    dragging = false;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const delta = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      dragging = true;
      container.setPointerCapture(event.pointerId);
      container.dataset.dragScroll = "dragging";
      window.getSelection()?.removeAllRanges();
    }
    container.scrollLeft = startScroll - delta;
    event.preventDefault();
  };

  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    syncScrollable();
  };

  // A drag must not also count as a click on whatever row it ended over.
  const onClickCapture = (event: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    event.stopPropagation();
    event.preventDefault();
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);
  container.addEventListener("click", onClickCapture, true);
  return () => {
    resizeObserver.disconnect();
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", endDrag);
    container.removeEventListener("pointercancel", endDrag);
    container.removeEventListener("click", onClickCapture, true);
  };
}

/**
 * Lets a mouse drag the table horizontally. Wraps a `<Table>` and drives its
 * own `[data-slot=table-container]`, which is the element that overflows.
 * Touch and trackpads keep their native scrolling.
 */
export function DragScrollTable({ children, className }: { children: ReactNode; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = rootRef.current?.querySelector<HTMLElement>("[data-slot=table-container]");
    if (!container) return;
    return attachDragScroll(container);
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("[&_[data-drag-scroll=idle]]:cursor-grab [&_[data-drag-scroll=dragging]]:cursor-grabbing [&_[data-drag-scroll=dragging]]:select-none", className)}
    >
      {children}
    </div>
  );
}

/**
 * A horizontal strip that scrolls by dragging with the mouse, like the tables
 * (e.g. a row of tabs wider than the screen). The scrollbar stays hidden.
 */
export function DragScrollArea({ children, className, ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? attachDragScroll(ref.current, { startOnInteractive: true }) : undefined), []);
  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      className={cn(
        "max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "data-[drag-scroll=idle]:cursor-grab data-[drag-scroll=dragging]:cursor-grabbing data-[drag-scroll=dragging]:select-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
