// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { DynamicNotice, NOTICE_DURATION_MS, type DynamicNoticeItem } from "./dynamic-notice";

const item: DynamicNoticeItem = { id: "n1", app: "Leads", title: "Novo lead: Maria", message: "PME, 3 vidas, campanha Outubro", actionLabel: "Atender", shape: "mochi", hue: 212 };

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("DynamicNotice", () => {
  it("announces the lead and opens it from the action or the card", () => {
    const onOpen = vi.fn();
    render(<DynamicNotice item={item} queuedCount={2} onOpen={onOpen} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status", { name: /Leads: Novo lead: Maria/ })).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Atender" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("status"));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("leaves by itself, but not while the broker holds it", () => {
    const onDismiss = vi.fn();
    render(<DynamicNotice item={item} onOpen={vi.fn()} onDismiss={onDismiss} />);
    const notice = screen.getByRole("status");
    fireEvent.pointerDown(notice);
    act(() => { vi.advanceTimersByTime(NOTICE_DURATION_MS + 500); });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerUp(notice);
    act(() => { vi.advanceTimersByTime(NOTICE_DURATION_MS); });
    expect(onDismiss).toHaveBeenCalledWith(item);
  });

  it("renders nothing without an item", () => {
    render(<DynamicNotice item={null} onOpen={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
