// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/arc/use-director-lite-page", () => ({ useDirectorLitePage: () => true }));

import styles from "./director-duty-calendar.module.css";
import { DutyMonthCalendar } from "./duty-month-calendar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderCalendar(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    media: "(max-width: 767px)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));

  const schedule = {
    id: "duty-1",
    name: "Plantão da unidade Centro",
    startsAt: "09:00",
    endsAt: "17:00",
    status: "active",
    validFrom: new Date("2026-10-25T03:00:00.000Z"),
    validUntil: null,
  };

  const { container } = render(
    <DutyMonthCalendar
      month="2026-10"
      schedules={[schedule]}
      progressById={new Map([["duty-1", { dates: [{ date: "2026-10-25", done: false }] }]])}
      publishedScheduleIds={new Set(["duty-1"])}
      gapScheduleIds={new Set()}
      repeatingScheduleIds={new Set()}
      canCreate
      onOpen={vi.fn()}
      onCreateOnDate={vi.fn()}
    />,
  );

  return {
    desktop: container.querySelector<HTMLElement>(`.${styles.desktop}`)!,
    mobile: container.querySelector<HTMLElement>(`.${styles.mobile}`)!,
  };
}

describe("DutyMonthCalendar Lite: foco por viewport", () => {
  it("retira os controles do calendário desktop da árvore de foco no celular", () => {
    const { desktop, mobile } = renderCalendar(true);

    expect(desktop.getAttribute("aria-hidden")).toBe("true");
    expect(desktop.hasAttribute("inert")).toBe(true);
    expect(mobile.hasAttribute("aria-hidden")).toBe(false);
    expect(mobile.hasAttribute("inert")).toBe(false);
  });

  it("retira os controles da lista móvel da árvore de foco no desktop", () => {
    const { desktop, mobile } = renderCalendar(false);

    expect(desktop.hasAttribute("aria-hidden")).toBe(false);
    expect(desktop.hasAttribute("inert")).toBe(false);
    expect(mobile.getAttribute("aria-hidden")).toBe("true");
    expect(mobile.hasAttribute("inert")).toBe(true);
  });
});
