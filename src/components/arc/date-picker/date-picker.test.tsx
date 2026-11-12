// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

vi.mock("../bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => open
    ? <section role="dialog" aria-label={title}><h2>{title}</h2>{children}</section>
    : null,
}));

vi.mock("../calendar/calendar", () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (media: string) => ({
      matches: media === "(max-width: 767px)",
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Arc DatePicker mobile sheet", () => {
  it("uses only the field label as the sheet title", async () => {
    render(<DatePicker label="Início da vigência" locale="pt-BR" />);

    fireEvent.click(screen.getByRole("button", { name: /Início da vigência/ }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "Início da vigência" })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Início da vigência" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Início da vigência calendário" })).toBeNull();
  });
});
