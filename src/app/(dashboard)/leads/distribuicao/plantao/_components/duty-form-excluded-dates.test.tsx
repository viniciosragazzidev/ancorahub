// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/distribuicao", useSearchParams: () => new URLSearchParams("view=plantao") }));
vi.mock("@/features/lead-distribution/duty-actions", () => ({
  createDutyScheduleAction: vi.fn(async () => ({ success: true, scheduleIds: [] })),
  updateDutyScheduleAction: vi.fn(),
  toggleDutyScheduleAction: vi.fn(),
  duplicateDutyScheduleAction: vi.fn(),
  archiveDutyScheduleAction: vi.fn(),
  deleteDutyScheduleAction: vi.fn(),
  restoreDutyScheduleAction: vi.fn(),
  setDutyAbsenceAction: vi.fn(),
}));
vi.mock("@/features/lead-distribution/roster-actions", () => ({}));
vi.mock("@/features/lead-distribution/duty-roster-pending-actions", () => ({}));
vi.mock("@/features/lead-distribution/monthly-duty-actions", () => ({ getMonthlyDutyPlanAction: vi.fn().mockResolvedValue(null) }));
vi.mock("@/features/lead-distribution/duty-type-actions", () => ({}));
vi.mock("@/features/lead-distribution/duty-swap-actions", () => ({}));
vi.mock("@/features/lead-distribution/duty-queue-order-actions", () => ({}));

import { createDutyScheduleAction } from "@/features/lead-distribution/duty-actions";
import { DutyOperationsWorkspace } from "./duty-operations-workspace";

const snapshot = { branches: [], queues: [], credentials: [], types: [], schedules: [], brokers: [], pendingBrokers: [], assignments: [], publishedAssignments: [], history: [] };

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, media: "", onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Novo plantão em massa: tirar dias antes de criar", () => {
  it("um dia clicado sai da lista e não é enviado para criar", async () => {
    render(<DutyOperationsWorkspace snapshot={snapshot as never} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Novo plantão/ })[0]);
    // seg 16/11 a sex 20/11 de 2026, dias úteis (padrão do formulário).
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-11-16" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-11-20" } });
    expect(screen.getByText(/Serão criados 5 plantões/)).toBeTruthy();
    expect(screen.getByText(/Clique no dia para tirá-lo/)).toBeTruthy();

    const days = within(screen.getByRole("group", { name: "Dias que terão plantão" }));
    fireEvent.click(days.getByRole("button", { name: /20\/11/ }));

    expect(screen.getByText(/Serão criados 4 plantões/)).toBeTruthy();
    expect(screen.getByText(/1 dia fora, sem plantão: Sex 20\/11/)).toBeTruthy();
    expect(days.getByRole("button", { name: /20\/11: fora/ }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: "Plantão Teste" } });
    fireEvent.submit(screen.getByLabelText(/Nome/).closest("form")!);
    await waitFor(() => expect(createDutyScheduleAction).toHaveBeenCalled());
    const formData = vi.mocked(createDutyScheduleAction).mock.calls[0]![1] as FormData;
    expect(JSON.parse(String(formData.get("dates")))).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
  });

  it("devolver o dia volta a contar", () => {
    render(<DutyOperationsWorkspace snapshot={snapshot as never} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Novo plantão/ })[0]);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-11-17" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-11-18" } });
    const days = within(screen.getByRole("group", { name: "Dias que terão plantão" }));
    fireEvent.click(days.getByRole("button", { name: /17\/11/ }));
    expect(screen.getByText(/Serão criados 1 plantão de um dia/)).toBeTruthy();
    fireEvent.click(days.getByRole("button", { name: /17\/11/ }));
    expect(screen.getByText(/Serão criados 2 plantões/)).toBeTruthy();
  });
});
