// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }), usePathname: () => "/plantoes" }));

import type { BrokerDutyCalendarOccurrence, BrokerDutyCalendarResult } from "../duty-calendar";
import type { DutyHubCurrent, DutyHubShift } from "../duty-hub";
import { BrokerDutyHub } from "./broker-duty-hub";

afterEach(() => { cleanup(); mocks.refresh.mockReset(); });

function shift(overrides: Partial<DutyHubShift> = {}): DutyHubShift {
  return {
    key: "active:s-pme",
    scheduleName: "Plantão PME",
    dateLabel: "Hoje",
    timeLabel: "13:00 às 17:00",
    place: "Matriz",
    modality: "Online",
    situation: { label: "Recebendo leads", tone: "success" },
    hint: null,
    href: "/plantoes/agora",
    ...overrides,
  };
}

function occurrence(day: number, overrides: Partial<BrokerDutyCalendarOccurrence> = {}): BrokerDutyCalendarOccurrence {
  const dutyDate = `2026-10-${String(day).padStart(2, "0")}`;
  return {
    id: `weekly:a:${dutyDate}`, assignmentId: "a", scheduleId: "s-pme", scheduleName: "Plantão PME", branchName: "Matriz",
    dutyDate, startsAt: "09:00", endsAt: "13:00", source: "weekly", paused: false, inProgress: false, endsNextDay: false,
    ...overrides,
  };
}

const calendar = (occurrences: BrokerDutyCalendarOccurrence[]): BrokerDutyCalendarResult => ({
  todayKey: "2026-09-30", firstMonthKey: "2026-09-01", monthCount: 3, endExclusiveKey: "2026-12-01", occurrences,
});

const current = (value: DutyHubCurrent) => value;

describe("BrokerDutyHub", () => {
  it("shows the plantão in progress with Abrir plantão, the calendar and Minha escala without repeating it", () => {
    const running = occurrence(1, { id: "running", dutyDate: "2026-09-30", inProgress: true, startsAt: "13:00", endsAt: "17:00" });
    render(<BrokerDutyHub
      current={current({ state: "active", shifts: [shift()], coveredOccurrenceIds: ["running"] })}
      calendar={calendar([running, occurrence(2)])}
      calendarState="ready"
    />);

    const card = screen.getByRole("region", { name: "Seu plantão atual" });
    expect(within(card).getByText("Em andamento")).toBeTruthy();
    expect(within(card).getByText("Recebendo leads")).toBeTruthy();
    expect(within(card).getByText("Online")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Abrir plantão" }).getAttribute("href")).toBe("/plantoes/agora");
    expect(screen.getByRole("region", { name: "Calendário dos seus plantões" })).toBeTruthy();

    const schedule = screen.getByRole("region", { name: "Minha escala" });
    expect(within(schedule).getAllByRole("button")).toHaveLength(1);
    expect(within(schedule).queryByText("13:00–17:00")).toBeNull();
    fireEvent.click(within(schedule).getByRole("button", { name: /Ver plantões de sexta-feira, 2 de outubro/ }));
    expect(screen.getByText("1 plantão nesta data")).toBeTruthy();
  });

  it("lets the broker choose between two plantões running now", async () => {
    render(<BrokerDutyHub
      current={current({ state: "active", shifts: [shift({ href: "/plantoes/agora?plantao=s-pme" }), shift({ key: "active:s-pres", scheduleName: "Presencial Tarde", modality: "Presencial", href: "/plantoes/agora?plantao=s-pres" })], coveredOccurrenceIds: [] })}
      calendar={null}
      calendarState="disabled"
    />);
    expect(screen.getByText("Você está em 2 plantões agora. Escolha qual abrir.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir plantão" }).getAttribute("href")).toBe("/plantoes/agora?plantao=s-pme");
    fireEvent.click(screen.getByRole("button", { name: "Presencial Tarde" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Abrir plantão" }).getAttribute("href")).toBe("/plantoes/agora?plantao=s-pres"));
    expect(screen.queryByRole("region", { name: "Minha escala" })).toBeNull();
  });

  it("shows the next plantão when there is none now, without an operation link", () => {
    render(<BrokerDutyHub
      current={current({ state: "next", shifts: [shift({ key: "next:x", dateLabel: "Sexta-feira, 2 de outubro", modality: null, situation: { label: "Próximo plantão", tone: "neutral" }, href: null })], coveredOccurrenceIds: [] })}
      calendar={null}
      calendarState="disabled"
    />);
    expect(screen.getByText("Você não está de plantão agora.")).toBeTruthy();
    expect(screen.getByText("Próximo plantão")).toBeTruthy();
    expect(screen.getByText("Sexta-feira, 2 de outubro, 13:00 às 17:00")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Abrir plantão" })).toBeNull();
  });

  it("explains an empty schedule and keeps the calendar", () => {
    render(<BrokerDutyHub current={current({ state: "none", shifts: [], coveredOccurrenceIds: [] })} calendar={calendar([])} calendarState="ready" />);
    expect(screen.getAllByText("Você não tem plantão marcado").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Calendário dos seus plantões" })).toBeTruthy();
    expect(screen.getByText(/Nenhum plantão marcado no período/)).toBeTruthy();
  });

  it("offers Tentar de novo on a loading failure and never claims there is no schedule", () => {
    render(<BrokerDutyHub current={current({ state: "error", shifts: [], coveredOccurrenceIds: [] })} calendar={null} calendarState="error" />);
    expect(screen.queryByText("Você não tem plantão marcado")).toBeNull();
    expect(screen.getByText(/Isso não quer dizer que você está sem escala/)).toBeTruthy();
    expect(screen.getByText(/Não consegui carregar o calendário e a sua escala/)).toBeTruthy();
    const retries = screen.getAllByRole("button", { name: "Tentar de novo" });
    expect(retries).toHaveLength(2);
    fireEvent.click(retries[0]!);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the first dates of Minha escala and expands the rest", () => {
    const many = [2, 3, 4, 5, 6, 7, 8].map((day) => occurrence(day));
    render(<BrokerDutyHub current={current({ state: "next", shifts: [shift({ href: null })], coveredOccurrenceIds: [] })} calendar={calendar(many)} calendarState="ready" />);
    const schedule = screen.getByRole("region", { name: "Minha escala" });
    expect(within(schedule).getAllByRole("button", { name: /Ver plantões de/ })).toHaveLength(5);
    fireEvent.click(within(schedule).getByRole("button", { name: "Ver mais 2 datas" }));
    expect(within(schedule).getAllByRole("button", { name: /Ver plantões de/ })).toHaveLength(7);
  });
});
