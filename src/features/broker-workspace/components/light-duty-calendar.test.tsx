// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LightDutyCalendar } from "./light-duty-calendar";
import type { BrokerDutyCalendarResult } from "../duty-calendar";

const calendar: BrokerDutyCalendarResult = {
  todayKey: "2026-09-30",
  firstMonthKey: "2026-09-01",
  monthCount: 3,
  endExclusiveKey: "2026-12-01",
  occurrences: [{
    id: "weekly:assignment-1:2026-09-30",
    assignmentId: "assignment-1",
    scheduleId: "schedule-1",
    scheduleName: "Plantão PME",
    branchName: "Matriz",
    dutyDate: "2026-09-30",
    startsAt: "13:00",
    endsAt: "17:00",
    source: "weekly",
    paused: false,
    inProgress: true,
    endsNextDay: false,
  }],
};

describe("LightDutyCalendar", () => {
  it("shows the selected date's shift and opens its read-only detail sheet", () => {
    render(<LightDutyCalendar calendar={calendar} />);

    expect(screen.getByRole("heading", { name: "Plantões" })).toBeTruthy();
    expect(screen.getByText("Em andamento")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Ver plantão Plantão PME/ }));

    expect(screen.getByText("Detalhes do seu plantão. Esta visualização não altera a escala.")).toBeTruthy();
    expect(screen.getByText("Escala semanal")).toBeTruthy();
    expect(screen.getAllByText("Matriz")).toHaveLength(2);
  });
});
