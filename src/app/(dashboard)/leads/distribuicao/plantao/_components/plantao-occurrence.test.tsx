// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAdd = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());

vi.mock("@/features/lead-distribution/monthly-duty-actions", () => ({
  addBrokerToPublishedOccurrenceAction: mockAdd,
  removeBrokerFromPublishedOccurrenceAction: mockRemove,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => <button type="button" onClick={onClick} disabled={disabled}>{children}</button>,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/components/ui/search-add-list", () => ({
  SearchAddList: ({ items, onAdd }: { items: Array<{ id: string; label: string }>; onAdd: (item: { id: string; label: string }) => void }) => (
    <ul>{items.map((item) => <li key={item.id}><button type="button" onClick={() => onAdd(item)}>Adicionar {item.label}</button></li>)}</ul>
  ),
}));

import { PlantaoOccurrenceSheet } from "./plantao-occurrence-sheet";
import { findPublishedOccurrence } from "./plantao-occurrence";

type Occ = Parameters<typeof PlantaoOccurrenceSheet>[0]["occurrence"];

function occurrence(overrides: Partial<Occ> = {}): Occ {
  return {
    id: "sch-1:2099-10-20", scheduleId: "sch-1", scheduleName: "Manhã", dutyDate: "2099-10-20", startsAt: "08:00", endsAt: "12:00",
    minimumBrokers: 1, maximumBrokers: 2, allowedBrokerIds: ["bruno"], typeId: "t1", attendanceMode: "any",
    brokers: [
      { id: "bruno", name: "Bruno", code: "C-1", branchId: "b1", branchName: "Central", forced: false, origin: "manual" },
      { id: "maria", name: "Maria", code: "C-2", branchId: "b1", branchName: "Central", forced: false, origin: "weekly" },
    ],
    assignedCount: 2, ended: false, started: false,
    ...overrides,
  } as unknown as Occ;
}

const brokers = [
  { id: "bruno", name: "Bruno", internalCode: "C-1", branchId: "b1" },
  { id: "maria", name: "Maria", internalCode: "C-2", branchId: "b1" },
  { id: "carla", name: "Carla", internalCode: "C-3", branchId: "b2" },
];

function renderSheet(overrides: Partial<Occ> = {}) {
  const onChanged = vi.fn();
  render(<PlantaoOccurrenceSheet open onOpenChange={vi.fn()} occurrence={occurrence(overrides)} scheduleName="Manhã" brokers={brokers} onChanged={onChanged} />);
  return { onChanged };
}

beforeEach(() => {
  mockAdd.mockReset();
  mockRemove.mockReset();
});
afterEach(() => cleanup());

describe("pílula de plantão publicado", () => {
  const plan = (status: string, publishedOccurrenceIds: string[] = []) => ({
    status,
    publishedOccurrenceIds,
    occurrences: [{ id: "sch-1:2099-10-20" }],
  }) as never;

  it("opens a plantão of a published escala, and a plantão that a newer draft carries as live", () => {
    expect(findPublishedOccurrence({ "2099-10": plan("published") }, "sch-1", "2099-10-20")).not.toBeNull();
    expect(findPublishedOccurrence({ "2099-10": plan("draft", ["sch-1:2099-10-20"]) }, "sch-1", "2099-10-20")).not.toBeNull();
  });

  it("does not open a plantão that exists only in a draft", () => {
    expect(findPublishedOccurrence({ "2099-10": plan("draft") }, "sch-1", "2099-10-20")).toBeNull();
    expect(findPublishedOccurrence({ "2099-10": plan("published") }, "sch-9", "2099-10-20")).toBeNull();
  });
});

describe("PlantaoOccurrenceSheet", () => {
  it("shows who is on the plantão and why, and offers removal only for the broker added now", () => {
    renderSheet();

    expect(screen.getByText("Escalado agora")).toBeTruthy();
    expect(screen.getByText("Escala semanal")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Tirar do plantão" })).toHaveLength(1);
  });

  it("asks for confirmation before taking someone off, and puts the new view on screen", async () => {
    mockRemove.mockResolvedValue({ id: "plan-9", occurrences: [] });
    const { onChanged } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Tirar do plantão" }));
    expect(mockRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith({ occurrenceId: "sch-1:2099-10-20", brokerId: "bruno" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("asks for confirmation when the broker's unit is outside the plantão's type, and adds with force when confirmed", async () => {
    mockAdd.mockResolvedValue({ id: "plan-9", occurrences: [] });
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Carla" }));
    expect(mockAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/não participa deste tipo de plantão/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Escalar mesmo assim" }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith({ occurrenceId: "sch-1:2099-10-20", brokerId: "carla", force: true }));
  });

  it("hides adding and removing on a plantão that already ended", () => {
    renderSheet({ ended: true });

    expect(screen.queryByRole("button", { name: "Tirar do plantão" })).toBeNull();
    expect(screen.queryByText("Escalar corretor")).toBeNull();
    expect(screen.getByText(/já terminou/)).toBeTruthy();
  });
});
