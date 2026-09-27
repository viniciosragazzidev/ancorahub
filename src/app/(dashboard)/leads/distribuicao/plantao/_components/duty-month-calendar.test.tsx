// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DutyMonthCalendar } from "./duty-month-calendar";

const pme23 = { id: "pme23", name: "PME 23/09", startsAt: "09:00", endsAt: "18:00", status: "active", validFrom: new Date("2026-09-23T03:00:00Z"), validUntil: new Date("2026-09-24T03:00:00Z") };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-26T13:00:00Z")); // Saturday 26/09
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function renderSeptember() {
  render(
    <DutyMonthCalendar
      month="2026-09"
      schedules={[pme23]}
      progressById={new Map([["pme23", { dates: [{ date: "2026-09-23", done: true }] }]])}
      publishedScheduleIds={new Set()}
      gapScheduleIds={new Set()}
      repeatingScheduleIds={new Set()}
      canCreate
      onOpen={vi.fn()}
      onCreateOnDate={vi.fn()}
    />,
  );
}

describe("DutyMonthCalendar", () => {
  it("hides whole past weeks without plantões and starts at the first week that matters", () => {
    renderSeptember();
    const days = screen.getAllByRole("gridcell").map((cell) => cell.getAttribute("aria-label")?.slice(0, 5));
    expect(days[0]).toBe("21/09");
    expect(days).not.toContain("14/09");
    expect(days).toContain("30/09");
  });

  it("shows each plantão on its own day and highlights today", () => {
    renderSeptember();
    expect(screen.getByRole("gridcell", { name: /23\/09: 1 plantões/ }).textContent).toContain("PME 23/09");
    expect(screen.getByRole("gridcell", { name: /26\/09/ }).textContent).toContain("hoje");
  });
});
