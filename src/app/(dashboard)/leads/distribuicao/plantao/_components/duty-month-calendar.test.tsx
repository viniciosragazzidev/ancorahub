// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DutyMonthCalendar } from "./duty-month-calendar";

const pme23 = { id: "pme23", name: "PME 23/09", startsAt: "09:00", endsAt: "18:00", status: "active", validFrom: new Date("2026-09-23T03:00:00Z"), validUntil: new Date("2026-09-24T03:00:00Z") };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T13:00:00Z")); // Friday 25/09
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
    const pastDay = screen.getByRole("gridcell", { name: /23\/09: 1 plantões/ });
    // A past day starts closed and opens on click.
    expect(pastDay.textContent).toContain("1 encerrado");
    expect(pastDay.textContent).not.toContain("PME 23/09");
    fireEvent.click(within(pastDay).getByRole("button", { name: "1 encerrado" }));
    expect(pastDay.textContent).toContain("PME 23/09");
    expect(screen.getByRole("gridcell", { name: /25\/09/ }).textContent).toContain("hoje");
  });

  it("shows Monday to Friday only", () => {
    renderSeptember();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex"]);
    expect(screen.queryByRole("gridcell", { name: /26\/09/ })).toBeNull();
    expect(screen.queryByRole("gridcell", { name: /27\/09/ })).toBeNull();
  });

  it("gives days with plantões a stronger highlight than empty days", () => {
    render(
      <DutyMonthCalendar
        month="2026-09"
        schedules={[{ ...pme23, id: "pme30", name: "PME 30/09" }]}
        progressById={new Map([["pme30", { dates: [{ date: "2026-09-30", done: false }] }]])}
        publishedScheduleIds={new Set()}
        gapScheduleIds={new Set()}
        repeatingScheduleIds={new Set()}
        canCreate
        onOpen={vi.fn()}
        onCreateOnDate={vi.fn()}
      />,
    );
    expect(screen.getByRole("gridcell", { name: /30\/09/ }).className).toContain("color-mix(in_oklab,var(--primary)");
    expect(screen.getByRole("gridcell", { name: /29\/09/ }).className).not.toContain("color-mix(in_oklab,var(--primary)");
  });
});

describe("DutyMonthCalendar order and past weeks", () => {
  it("puts the plantão running now above the others of today", () => {
    vi.setSystemTime(new Date("2026-09-25T17:00:00Z")); // 14:00 in São Paulo
    const morning = { ...pme23, id: "manha", name: "MANHA", startsAt: "09:00", endsAt: "13:30" };
    const afternoon = { ...pme23, id: "tarde", name: "TARDE", startsAt: "13:30", endsAt: "19:00" };
    render(
      <DutyMonthCalendar
        month="2026-09"
        schedules={[morning, afternoon]}
        progressById={new Map([["manha", { dates: [{ date: "2026-09-25", done: false }] }], ["tarde", { dates: [{ date: "2026-09-25", done: false }] }]])}
        publishedScheduleIds={new Set()}
        gapScheduleIds={new Set()}
        repeatingScheduleIds={new Set()}
        canCreate
        onOpen={vi.fn()}
        onCreateOnDate={vi.fn()}
      />,
    );
    const names = within(screen.getByRole("gridcell", { name: /25\/09/ })).getAllByRole("button").map((button) => button.textContent ?? "").filter((text) => /MANHA|TARDE/.test(text));
    expect(names[0]).toContain("TARDE");
  });

  it("hides weeks that are over until asked", () => {
    vi.setSystemTime(new Date("2026-09-29T13:00:00Z")); // Tuesday 29/09
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
    expect(screen.queryByRole("gridcell", { name: /23\/09/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /semana que já passou/ }));
    expect(screen.getByRole("gridcell", { name: /23\/09/ })).toBeTruthy();
  });
});
