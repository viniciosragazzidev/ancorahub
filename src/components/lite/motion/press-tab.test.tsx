// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LitePress } from "./press";

afterEach(cleanup);

it("o invólucro do LitePress não vira parada extra no Tab", () => {
  render(<LitePress><a href="/x">Abrir</a></LitePress>);
  const wrapper = screen.getByRole("link", { name: "Abrir" }).parentElement!;
  expect(wrapper.getAttribute("tabindex")).toBe("-1");
});
