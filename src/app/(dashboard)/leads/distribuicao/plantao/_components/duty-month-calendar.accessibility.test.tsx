// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/arc/use-director-lite-page", () => ({ useDirectorLitePage: () => true }));

import styles from "./plantoes-1a1.module.css";
import { DutyMonthCalendar } from "./duty-month-calendar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderCalendar() {
  const schedule = {
    id: "duty-1",
    name: "Plantão da unidade Centro",
    startsAt: "09:00",
    endsAt: "17:00",
    status: "active",
    validFrom: new Date("2026-10-26T03:00:00.000Z"),
    validUntil: null,
  };

  const { container } = render(
    <DutyMonthCalendar
      month="2026-10"
      schedules={[schedule]}
      progressById={new Map([["duty-1", { dates: [{ date: "2026-10-26", done: false }] }]])}
      publishedScheduleIds={new Set(["duty-1"])}
      gapScheduleIds={new Set()}
      repeatingScheduleIds={new Set()}
      canCreate
      onOpen={vi.fn()}
      onCreateOnDate={vi.fn()}
    />,
  );

  return {
    desktop: container.querySelector<HTMLElement>(`.${styles.calDesktop}`),
    mobile: container.querySelector<HTMLElement>(`.${styles.mDays}`),
  };
}

/*
 * Plantões 1:1 (27/11/2026): a grade do computador e a lista do celular são trocadas pelo CSS do artifact
 * (`display: none` por largura), o que já tira a versão escondida da árvore de foco e da leitura de tela.
 */
describe("DutyMonthCalendar Lite: grade no computador, lista no celular", () => {
  it("monta a grade de segunda a sexta dentro do bloco do computador", () => {
    const { desktop } = renderCalendar();
    expect(desktop).not.toBeNull();
    expect(desktop!.querySelector('[role="grid"]')?.getAttribute("aria-label")).toBe("Calendário de plantões");
    expect(desktop!.querySelectorAll('[role="columnheader"]')).toHaveLength(5);
  });

  it("monta a lista por dia dentro do bloco do celular", () => {
    const { mobile } = renderCalendar();
    expect(mobile).not.toBeNull();
    expect(mobile!.getAttribute("aria-label")).toBe("Plantões do mês");
    expect(mobile!.textContent).toContain("Plantão da unidade Centro");
  });
});
