// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("./actions", () => ({ setRankingOptOutAction: mocks.save }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});
import { RankingPreferences } from "./ranking-preferences";
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({ ok: true }); });
it("uses an accessible Arc switch and explains visibility without losing private progress", async () => {
  render(<RankingPreferences initialOptOut={false} />);
  const control = screen.getByRole("switch", { name: "Aparecer no placar da unidade" });
  expect(control.getAttribute("aria-checked")).toBe("true");
  expect(control.getAttribute("aria-describedby")).toBeTruthy();
  expect(screen.getByText(/Sair do placar mantém seus pontos/)).toBeTruthy();
  fireEvent.click(control);
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(true));
  await waitFor(() => expect(control.getAttribute("aria-checked")).toBe("false"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Seus pontos continuam"));
});
it("shows pending on the control, prevents duplicate submission and keeps the old value until saved", async () => {
  let done: (result: { ok: true }) => void = () => undefined;
  mocks.save.mockImplementation(() => new Promise((resolve) => { done = resolve; }));
  render(<RankingPreferences initialOptOut={true} />);
  const control = screen.getByRole("switch");
  fireEvent.click(control);
  await waitFor(() => expect(control.getAttribute("aria-busy")).toBe("true"));
  expect(control.hasAttribute("disabled")).toBe(true);
  expect(control.getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("status").textContent).toContain("Salvando");
  fireEvent.click(control); expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true }));
  expect(control.getAttribute("aria-checked")).toBe("true");
});
it("shows failure beside the switch and allows retry without changing saved visibility", async () => {
  mocks.save.mockResolvedValueOnce({ ok: false, message: "Tente novamente." });
  render(<RankingPreferences initialOptOut={false} />);
  const control = screen.getByRole("switch");
  fireEvent.click(control);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Tente novamente."));
  expect(control.getAttribute("aria-checked")).toBe("true");
  expect(control.getAttribute("aria-invalid")).toBe("true");
  fireEvent.click(control);
  await waitFor(() => expect(control.getAttribute("aria-checked")).toBe("false"));
});
it("catches network errors and disables the control while the migration is unavailable", async () => {
  mocks.save.mockRejectedValue(new Error("offline"));
  const { unmount } = render(<RankingPreferences initialOptOut={false} />);
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Tente novamente"));
  unmount();
  render(<RankingPreferences initialOptOut={false} schemaReady={false} />);
  expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("sendo preparado");
});
