import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/arc/use-director-lite-page", () => ({ useDirectorLitePage: () => false }));

import { DutyMonthCalendar } from "./duty-month-calendar";

describe("HTML legado do calendário de plantões", () => {
  it("mantém o HTML da base d2d80a01 com a chave desligada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T16:00:00.000Z"));
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
        progressById={new Map([["duty-1", { dates: [{ date: "2026-10-26", done: false }] }]])}
        publishedScheduleIds={new Set(["duty-1"])}
        gapScheduleIds={new Set()}
        repeatingScheduleIds={new Set()}
        canCreate
        onOpen={() => undefined}
        onCreateOnDate={() => undefined}
      />,
    );
    vi.useRealTimers();

    expect(html).toMatchSnapshot("origin d2d80a01, chave desligada");
  });
});
