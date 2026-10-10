// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JourneyCelebration } from "@/features/engagement/journey-types";

import { CelebrationLayer, orderCelebrations } from "./celebration-layer";

const points = (overrides: Partial<JourneyCelebration> = {}): JourneyCelebration =>
  ({
    id: "p1",
    userId: "u1",
    kind: "points",
    payload: { kind: "points", points: 15, ruleKey: "contact.evidenced" as never, label: "Contato realizado" },
    priority: 10,
    createdAt: "2026-10-10T12:00:00.000Z",
    seenAt: null,
    ...overrides,
  }) as JourneyCelebration;

const mission = (overrides: Partial<JourneyCelebration> = {}): JourneyCelebration =>
  ({
    id: "m1",
    userId: "u1",
    kind: "mission",
    payload: { kind: "mission", missionId: "mi1", title: "Cobertura rápida", bonusPoints: 25, periodKey: "2026-10-10" },
    priority: 50,
    createdAt: "2026-10-10T12:00:05.000Z",
    seenAt: null,
    ...overrides,
  }) as JourneyCelebration;

afterEach(() => cleanup());

describe("orderCelebrations", () => {
  it("puts big moments first, ignores seen items and daily summaries", () => {
    const queue = orderCelebrations([
      points({ id: "p-early", priority: 30, createdAt: "2026-10-10T09:00:00.000Z" }),
      points({ id: "p-seen", priority: 99, seenAt: "2026-10-10T12:30:00.000Z" }),
      {
        id: "s1",
        userId: "u1",
        kind: "daily_summary",
        payload: { kind: "daily_summary", date: "2026-10-09", received: 8, onTimeContacts: 6, points: 30 },
        priority: 100,
        createdAt: "2026-10-10T11:00:00.000Z",
        seenAt: null,
      } as JourneyCelebration,
      points({ id: "p-late", priority: 20, createdAt: "2026-10-10T13:00:00.000Z" }),
      mission({ id: "m-first" }),
    ]);
    expect(queue.map((item) => item.id)).toEqual(["m-first", "p-early", "p-late"]);
  });

  it("orders points of the same tier by priority, then by oldest first", () => {
    const a = points({ id: "a", priority: 10, createdAt: "2026-10-10T10:00:00.000Z" });
    const b = points({ id: "b", priority: 10, createdAt: "2026-10-10T10:00:01.000Z" });
    const c = points({ id: "c", priority: 15, createdAt: "2026-10-10T10:00:02.000Z" });
    const queue = orderCelebrations([b, a, c]);
    expect(queue.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
});

describe("CelebrationLayer", () => {
  it("renders nothing while blocked (a lead offer or SLA alert wins)", () => {
    const onSeen = vi.fn();
    render(<CelebrationLayer items={[mission(), points()]} blocked onSeen={onSeen} />);
    expect(screen.queryByText("Missão concluída")).toBeNull();
    expect(screen.queryByLabelText(/Mais 15 pontos/)).toBeNull();
    expect(onSeen).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the points toast and calls onSeen when it is clicked", () => {
    const onSeen = vi.fn();
    render(<CelebrationLayer items={[points()]} onSeen={onSeen} />);
    const toast = screen.getByRole("button", { name: /Mais 15 pontos: Contato realizado/ });
    fireEvent.click(toast);
    expect(onSeen).toHaveBeenCalledWith(["p1"]);
  });

  it("shows the mission card with a Continuar button and calls onSeen when clicked", () => {
    const onSeen = vi.fn();
    render(<CelebrationLayer items={[mission()]} onSeen={onSeen} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Missão concluída")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onSeen).toHaveBeenCalledWith(["m1"]);
  });

  it("shows big moments before the points toast and queues Continuar", async () => {
    const onSeen = vi.fn();
    render(<CelebrationLayer items={[points({ id: "p-2", priority: 40 }), mission()]} onSeen={onSeen} />);
    // The first screen is the big moment, with the queue hint on the button.
    expect(screen.getByRole("button", { name: "Continuar (mais 1)" })).toBeTruthy();
    expect(screen.queryByLabelText(/Mais 15 pontos/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continuar (mais 1)" }));
    expect(onSeen).toHaveBeenCalledWith(["m1"]);
    // After the mission, the next celebration becomes the points toast.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /Mais 15 pontos/ })).toBeTruthy();
  });
});
