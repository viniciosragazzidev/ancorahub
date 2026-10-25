import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/arc/use-director-lite-page", () => ({ useDirectorLitePage: () => true }));

import { DutyMonthCalendar } from "./duty-month-calendar";

describe("calendário de plantões no Lite do diretor", () => {
  it("oferece a lista móvel com data e horário em português", () => {
    const schedule = {
      id: "duty-1",
      name: "Plantão presencial da unidade Centro",
      startsAt: "09:00",
      endsAt: "17:00",
      status: "active",
      validFrom: new Date("2026-10-25T03:00:00.000Z"),
      validUntil: null,
    };
    const html = renderToStaticMarkup(
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

    expect(html).toContain('aria-label="Plantões do mês"');
    expect(html).toContain("Plantão presencial da unidade Centro");
    expect(html).toContain("09:00 às 17:00 · escala publicada");
    expect(html).toContain("25 de outubro");
    expect(html).toContain('type="date"');
    expect(html).toContain("Novo plantão");
  });
});
