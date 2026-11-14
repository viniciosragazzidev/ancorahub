// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { resetFirstTimeTodayMemory } from "@/components/motion/first-time-today/first-time-today-core";
import { WeekRanking, type HomeHighlights } from "./week-ranking";
import { GoalFill } from "./chat-home";

const data: HomeHighlights = {
  ranks: [
    { key: "vendas", position: 2, label: "em vendas", total: 10 },
    { key: "aceite", position: 4, label: "no aceite", total: 10 },
  ],
  acceptTime: null,
  mission: null,
};

beforeEach(() => {
  window.localStorage.clear();
  resetFirstTimeTodayMemory();
});
afterEach(cleanup);

function openSheet() {
  render(<WeekRanking data={data} />);
  fireEvent.click(screen.getByRole("button", { name: /Ver sua semana/ }));
  return Array.from(document.querySelectorAll("[data-animate]"));
}

it("ranking da semana anima na primeira abertura do dia e não na segunda", () => {
  expect(openSheet()).toHaveLength(2);
  cleanup();
  expect(screen.queryByRole("list", { name: "Suas posições" })).toBeNull();
  expect(openSheet()).toHaveLength(0);
  expect(screen.getByRole("list", { name: "Suas posições" })).toBeTruthy();
});

it("meta do dia preenche só na primeira abertura do dia", () => {
  const { container, unmount } = render(<GoalFill percentage={60} />);
  expect(container.querySelector("[data-animate]")).not.toBeNull();
  unmount();
  const second = render(<GoalFill percentage={60} />);
  expect(second.container.querySelector("[data-animate]")).toBeNull();
});
