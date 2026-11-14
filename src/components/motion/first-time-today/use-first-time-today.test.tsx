// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetFirstTimeTodayMemory } from "./first-time-today-core";
import { FIRST_TIME_TODAY_DECISION_WINDOW_MS, useFirstTimeToday } from "./use-first-time-today";

function Probe({ id, enabled }: { id: string; enabled?: boolean }) {
  const first = useFirstTimeToday("probe", enabled);
  return <span data-testid={id}>{first ? "anima" : "parado"}</span>;
}

beforeEach(() => {
  window.localStorage.clear();
  resetFirstTimeTodayMemory();
});
let roots: Root[] = [];
afterEach(() => {
  cleanup();
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.innerHTML = "";
  vi.useRealTimers();
});

/** Carga completa: HTML do servidor e depois hidratação no cliente. */
function hydrate(element: React.ReactElement) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.appendChild(container);
  const onRecoverableError = vi.fn();
  act(() => {
    roots.push(hydrateRoot(container, element, { onRecoverableError }));
  });
  return { container, onRecoverableError };
}

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

it("na carga completa anima depois da hidratação, sem mismatch, e só uma vez no dia", () => {
  const first = hydrate(<Probe id="full" />);
  expect(first.onRecoverableError).not.toHaveBeenCalled();
  expect(first.container.textContent).toBe("anima");

  const second = hydrate(<Probe id="full-2" />);
  expect(second.onRecoverableError).not.toHaveBeenCalled();
  expect(second.container.textContent).toBe("parado");
});

it("na carga completa espera o movimento ligar (kill-switch buscado depois) para decidir", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<Probe id="late" enabled={false} />);
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = hydrateRoot(container, <Probe id="late" enabled={false} />);
  });
  roots.push(root);
  expect(container.textContent).toBe("parado");
  act(() => root.render(<Probe id="late" enabled />));
  expect(container.textContent).toBe("anima");
});

it("se o movimento só liga depois da janela, não anima nem gasta a primeira vez", () => {
  vi.useFakeTimers();
  const { rerender } = render(<Probe id="slow" enabled={false} />);
  act(() => vi.advanceTimersByTime(FIRST_TIME_TODAY_DECISION_WINDOW_MS + 1));
  rerender(<Probe id="slow" enabled />);
  expect(screen.getByTestId("slow").textContent).toBe("parado");
  cleanup();
  render(<Probe id="next" />);
  expect(screen.getByTestId("next").textContent).toBe("anima");
});
