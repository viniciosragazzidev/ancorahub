// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it } from "vitest";
import { resetFirstTimeTodayMemory } from "./first-time-today-core";
import { useFirstTimeToday } from "./use-first-time-today";

function Probe({ id, enabled }: { id: string; enabled?: boolean }) {
  const first = useFirstTimeToday("probe", enabled);
  return <span data-testid={id}>{first ? "anima" : "parado"}</span>;
}

beforeEach(() => {
  window.localStorage.clear();
  resetFirstTimeTodayMemory();
});
afterEach(cleanup);

it("anima na primeira montagem do dia e não na segunda", () => {
  render(<Probe id="a" />);
  expect(screen.getByTestId("a").textContent).toBe("anima");
  cleanup();
  render(<Probe id="b" />);
  expect(screen.getByTestId("b").textContent).toBe("parado");
});

it("desligado (movimento reduzido ou kill-switch) não anima nem gasta a primeira vez", () => {
  render(<Probe id="a" enabled={false} />);
  expect(screen.getByTestId("a").textContent).toBe("parado");
  cleanup();
  render(<Probe id="b" />);
  expect(screen.getByTestId("b").textContent).toBe("anima");
});

it("no SSR considera já visto", () => {
  expect(renderToString(<Probe id="ssr" />)).toContain("parado");
});
