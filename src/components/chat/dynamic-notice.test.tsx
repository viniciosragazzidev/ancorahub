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

  it("rests as a pill on its own without resolving the lead, and a tap opens the card again", () => {
    const onDismiss = vi.fn();
    const onOpen = vi.fn();
    render(<DynamicNotice item={{ ...item, pillLabel: "Lead novo" }} onOpen={onOpen} onDismiss={onDismiss} />);
    const notice = screen.getByRole("status");
    fireEvent.pointerDown(notice);
    act(() => { vi.advanceTimersByTime(NOTICE_DURATION_MS + 500); });
    expect(screen.getByRole("button", { name: "Atender" })).toBeTruthy();
    fireEvent.pointerUp(notice);
    fireEvent.mouseLeave(notice);
    act(() => { vi.advanceTimersByTime(NOTICE_DURATION_MS); });
    // Resting: the card closed, nothing was resolved or marked as read.
    expect(screen.queryByRole("button", { name: "Atender" })).toBeNull();
    expect(screen.getByText("Lead novo")).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(notice);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Atender" })).toBeTruthy();
  });

  it("renders nothing without an item", () => {
    render(<DynamicNotice item={null} onOpen={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
