// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("motion/react", async () => ({ ...await vi.importActual<typeof import("motion/react")>("motion/react"), useReducedMotion: () => true }));
import { WeekRanking } from "./week-ranking";
afterEach(cleanup);
it("renders real stage progress accessibly and does not invent a bonus", () => {
  render(<WeekRanking data={{ ranks: [], acceptTime: null, mission: { title: "Registrar etapas", detail: "3 de 5 leads com etapa. Bônus de 10 pts ao fechar o dia.", href: "/jornada", progress: { missionId: "steps", subjectId: "broker-text", periodKey: "2026-10-10", progress: 3, target: 5, percentage: 60, remaining: 2, eligible: true, completed: false, completedAt: null } } }} />);
  const bar = screen.getByRole("progressbar", { name: "Etapas registradas" });
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(bar.getAttribute("aria-valuemax")).toBe("5");
  expect(screen.getByRole("link").getAttribute("href")).toBe("/jornada");
  expect(screen.getByText(/ao fechar o dia/)).toBeTruthy();
});
