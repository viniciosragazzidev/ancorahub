// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThreadList } from "./thread-row";
import type { ThreadSummary } from "./types";

afterEach(() => cleanup());

const lead = (id: string, name: string, at: string | null, waitingYou = false): ThreadSummary => ({
  id, kind: "lead", leadId: id, name, preview: "Atendimento em andamento.", at, unread: false, waitingYou, href: `/leads/${id}`, shape: "mochi", hue: null, initials: name.slice(0, 2),
});

describe("ThreadList grouped by day", () => {
  const now = new Date("2026-10-21T10:00:00-03:00");

  it("splits leads by arrival day, newest first, ignoring who is waiting", () => {
    render(<ThreadList now={now} emptyText="vazio" groupByDay threads={[
      lead("1", "Esperando antigo", "2026-10-17T09:00:00-03:00", true),
      lead("2", "Ontem", "2026-10-20T18:00:00-03:00"),
      lead("3", "Hoje", "2026-10-21T09:30:00-03:00"),
    ]} />);

    const sections = screen.getAllByRole("region");
    expect(sections.map((section) => section.getAttribute("aria-label"))).toEqual(["Hoje", "Ontem", "17/10 (sáb)"]);
    expect(within(sections[0]!).getByText("09:30")).toBeTruthy();
    expect(within(sections[2]!).getByText("Esperando antigo")).toBeTruthy();
  });

  it("keeps the flat list when not grouped", () => {
    render(<ThreadList now={now} emptyText="vazio" threads={[lead("1", "A", null)]} />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
