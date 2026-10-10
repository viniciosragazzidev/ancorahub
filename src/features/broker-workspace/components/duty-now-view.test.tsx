// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { DutyNowView, type DutyNowViewData } from "./duty-now-view";

afterEach(() => cleanup());

const data: DutyNowViewData = {
  scheduleName: "PRESENCIAL TARDE",
  queueName: "PME",
  branchName: "Nova Iguaçu",
  startsAt: "2026-10-10T16:30:00.000Z",
  endsAt: "2026-10-10T22:00:00.000Z",
  state: "ativo",
  leads: [
    { leadId: "l1", name: "Bruna Pfeiffer", origin: "oferta", status: "Em Atendimento", tone: "ok", at: "2026-10-10T17:00:00.000Z", acceptSeconds: 45, openable: true },
    { leadId: "l2", name: "Carlos Souza", origin: "atribuicao", status: "Distribuído", tone: "ok", at: "2026-10-10T18:00:00.000Z", acceptSeconds: null, openable: true },
    { leadId: "l3", name: "Dora Lima", origin: "oferta", status: "Expirou", tone: "lost", at: "2026-10-10T18:30:00.000Z", acceptSeconds: null, openable: false },
  ],
  totals: { offered: 1, accepted: 1, missed: 0, started: 1, medianAcceptSeconds: 45 },
};

describe("DutyNowView", () => {
  it("shows the plantão, its progress, the numbers and every lead received in it", () => {
    render(<DutyNowView data={data} nowIso="2026-10-10T19:15:00.000Z" />);
    expect(screen.getByRole("heading", { name: "PRESENCIAL TARDE" })).toBeTruthy();
    expect(screen.getByText("Recebendo leads")).toBeTruthy();
    expect(screen.getByText("50% do plantão")).toBeTruthy();
    expect(screen.getByText("Termina em 2 h 45 min")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Bruna Pfeiffer/ }).getAttribute("href")).toBe("/leads/l1");
    expect(screen.getByText(/aceito em 45 s/)).toBeTruthy();
    expect(screen.getByText(/Atribuído a você/)).toBeTruthy();
    // An expired offer is listed but does not open (the lead is no longer the broker's).
    expect(screen.queryByRole("link", { name: /Dora Lima/ })).toBeNull();
    expect(screen.getByText("Dora Lima")).toBeTruthy();
  });

  it("says when no lead arrived yet", () => {
    render(<DutyNowView data={{ ...data, leads: [], totals: { offered: 0, accepted: 0, missed: 0, started: 0, medianAcceptSeconds: null } }} nowIso="2026-10-10T17:00:00.000Z" />);
    expect(screen.getByText(/Nenhum lead ainda/)).toBeTruthy();
  });
});
