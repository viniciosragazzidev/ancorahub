/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme("dark")}>{theme}</button>;
}

describe("tema claro do piloto Diretor Lite", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
    document.cookie = "corretop-theme=; Path=/; Max-Age=0";
  });

  it("força claro sem sobrescrever a preferência escura salva", () => {
    localStorage.setItem("corretop-theme", "dark");
    document.cookie = "corretop-theme=dark; Path=/";
    document.documentElement.classList.add("dark");

    render(<ThemeProvider forceLightTheme><ThemeProbe /></ThemeProvider>);

    expect(screen.getByRole("button").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("corretop-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("light");
    expect(localStorage.getItem("corretop-theme")).toBe("dark");
  });

  it("recupera a preferência salva depois de desligar o piloto", () => {
    localStorage.setItem("corretop-theme", "dark");
    const view = render(<ThemeProvider forceLightTheme><ThemeProbe /></ThemeProvider>);

    view.rerender(<ThemeProvider forceLightTheme={false}><ThemeProbe /></ThemeProvider>);

    expect(screen.getByRole("button").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
