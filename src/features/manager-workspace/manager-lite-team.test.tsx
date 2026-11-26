// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: ({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) => <div>{trigger}{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/(dashboard)/equipe/actions", () => ({ createTeamUserAction: vi.fn(), resendInviteAction: vi.fn(), revokeInviteAction: vi.fn() }));
vi.mock("@/features/supervisor-workspace/transfer-actions", () => ({ decideBrokerTransferAction: vi.fn() }));

import { ManagerLiteTeam } from "./manager-lite-team";

describe("ManagerLiteTeam", () => {
  it("shows only the scoped initial data and filters by broker name", () => {
    render(<ManagerLiteTeam initialTransfers={[]} initialData={{
      unitBranchId: "unit-a", unitName: "Centro", slaMinutes: 15, counts: { brokers: 2, inService: 3, late: 1 }, unassignedBrokers: [], supervisorInvites: [], members: [
        { id: "ada", userId: "ada", name: "Ada Costa", image: null, email: "ada@example.com", availability: "available", status: "active", inviteId: null, inService: 2, late: 1 },
        { id: "beto", userId: "beto", name: "Beto Lima", image: null, email: "beto@example.com", availability: "offline", status: "active", inviteId: null, inService: 1, late: 0 },
      ],
    }} />);
    expect(screen.getAllByText("Centro")).toHaveLength(2);
    expect(screen.getByText("Corretores da unidade")).toBeTruthy();
    expect(screen.getByText("Ada Costa")).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Buscar corretor por nome" });
    fireEvent.change(search, { target: { value: "beto" } });
    expect(screen.getByText("Beto Lima")).toBeTruthy();
    expect(screen.queryByText("Ada Costa")).toBeNull();
  });

  it("renders the pending invitation actions", () => {
    render(<ManagerLiteTeam initialTransfers={[]} initialData={{ unitBranchId: "unit-a", unitName: "Centro", slaMinutes: 15, counts: { brokers: 0, inService: 0, late: 0 }, unassignedBrokers: [], supervisorInvites: [], members: [
      { id: "profile-1", userId: null, name: "Novo corretor", image: null, email: "novo@example.com", availability: "offline", status: "pending", inviteId: "invite-1", inService: 0, late: 0 },
    ] }} />);
    expect(screen.getByRole("button", { name: "Reenviar convite" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar convite" })).toBeTruthy();
    // Convite pendente não ganha "Nunca entrou": o selo já diz que falta o primeiro acesso.
    expect(screen.queryByText("Nunca entrou")).toBeNull();
  });

  it("shows the last access per broker, muted after 7 days or never, with full date in the title", () => {
    render(<ManagerLiteTeam initialTransfers={[]} initialData={{
      unitBranchId: "unit-a", unitName: "Centro", slaMinutes: 15, renderedAt: "2026-11-25T17:00:00.000Z", counts: { brokers: 3, inService: 0, late: 0 }, unassignedBrokers: [], supervisorInvites: [], members: [
        { id: "ada", userId: "ada", name: "Ada Costa", image: null, email: "ada@example.com", availability: "available", status: "active", inviteId: null, inService: 0, late: 0, lastAccessAt: "2026-11-25T14:00:00.000Z" },
        { id: "beto", userId: "beto", name: "Beto Lima", image: null, email: "beto@example.com", availability: "offline", status: "active", inviteId: null, inService: 0, late: 0, lastAccessAt: "2026-11-10T14:00:00.000Z" },
        { id: "caio", userId: "caio", name: "Caio Reis", image: null, email: "caio@example.com", availability: "offline", status: "active", inviteId: null, inService: 0, late: 0, lastAccessAt: null },
      ],
    }} />);
    const recent = screen.getByText("Entrou há 3 h");
    expect(recent.getAttribute("title")).toBe("Último acesso em 25/11/2026 às 11:00");
    expect(recent.hasAttribute("data-stale")).toBe(false);
    expect(screen.getByText("Entrou há 15 dias").hasAttribute("data-stale")).toBe(true);
    expect(screen.getByText("Nunca entrou").hasAttribute("data-stale")).toBe(true);
  });

  it("hides the last access when the aggregated query was unavailable", () => {
    const { container } = render(<ManagerLiteTeam initialTransfers={[]} initialData={{
      unitBranchId: "unit-a", unitName: "Centro", slaMinutes: 15, counts: { brokers: 1, inService: 0, late: 0 }, unassignedBrokers: [], supervisorInvites: [], members: [
        { id: "ada", userId: "ada", name: "Ada Costa", image: null, email: "ada@example.com", availability: "available", status: "active", inviteId: null, inService: 0, late: 0 },
      ],
    }} />);
    expect(container.textContent).not.toMatch(/Entrou|Nunca entrou/);
  });
});
