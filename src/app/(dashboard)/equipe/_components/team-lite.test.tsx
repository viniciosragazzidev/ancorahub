// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const team = vi.hoisted(() => ({
  bulkToggleTeamMemberStatusAction: vi.fn(async () => ({ success: true, message: "ok" })),
  toggleTeamMemberStatusAction: vi.fn(async () => ({ success: true, status: "disabled" })),
  resendInviteAction: vi.fn(async () => ({ success: true })),
  revokeInviteAction: vi.fn(async () => ({ success: true })),
  deleteTeamMemberAction: vi.fn(async () => ({ success: true })),
  transferLeadsAction: vi.fn(async () => ({ success: true })),
  updateTeamMemberAction: vi.fn(async () => ({ success: true })),
  generateResetPasswordLinkAction: vi.fn(async () => ({ success: true, resetUrl: "/redefinir?token=1", resetWhatsApp: "sent" })),
  createTeamUserAction: vi.fn(),
  importBrokersAction: vi.fn(),
}));
vi.mock("../actions", () => team);
const branchActions = vi.hoisted(() => ({ setBrokersAvailabilityAction: vi.fn(async () => ({ success: true })) }));
vi.mock("@/features/branches/actions", () => branchActions);
vi.mock("@/features/supervisor-workspace/transfer-actions", () => ({ decideBrokerTransferAction: vi.fn(async () => ({ ok: true })) }));

import { TeamLite } from "./team-lite";
import type { TeamMemberLite } from "./member-sheets-lite";

afterEach(cleanup);

const base = { phone: null, jobTitle: "broker", branchId: "b1", branchName: "Centro", canEditAuthority: true, canManage: true } as const;
const members: TeamMemberLite[] = [
  { ...base, id: "m1", userId: "u1", name: "Ana Souza", email: "ana@x.com", role: "broker", status: "active", phone: "21999990000" },
  { ...base, id: "m2", userId: null, name: "Bruno Lima", email: "bruno@x.com", role: "broker", status: "pending", branchId: "b2", branchName: "Barra" },
  { ...base, id: "m3", userId: "u3", name: "Carla Dias", email: "carla@x.com", role: "manager", jobTitle: "manager", status: "active", canManage: false },
];
const stats = { total: 3, active: 2, unassignedLeads: 1, salesTotal: 1000, membersTrend: [], leadsTrend: [], salesTrend: [] };

function renderTeam(role: "director" | "manager" | "supervisor" = "director") {
  return render(<TeamLite members={members} branches={[{ id: "b1", name: "Centro" }, { id: "b2", name: "Barra" }]} customRoles={[]} stats={stats} transferRequests={[]} showTransfers currentRole={role} currentBranchId={null} currentUserId="u1" canViewProfile />);
}
const table = () => document.querySelector('[data-lite="table"]') as HTMLElement;

describe("TeamLite", () => {
  it("busca por WhatsApp, filtra por unidade e mostra o próprio usuário", () => {
    renderTeam();
    expect(within(table()).getByText(/Você · ana@x.com/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar colaborador" }), { target: { value: "99999" } });
    expect(table().querySelectorAll("tbody tr")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar colaborador" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Filtrar por unidade/ }));
    fireEvent.click(screen.getByRole("option", { name: "Barra" }));
    expect(table().querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("lote: pausa pela mesma Server Action e só os corretores ativos", async () => {
    renderTeam();
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Selecionar Ana Souza" }));
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Selecionar Bruno Lima" }));
    const bar = within(screen.getByRole("region", { name: "Ações em lote" }));
    await act(async () => { fireEvent.click(bar.getByRole("button", { name: "Pausar recebimento" })); });
    const availability = (branchActions.setBrokersAvailabilityAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(availability.get("brokerIds")).toBe("u1");
    expect(availability.get("target")).toBe("paused");
  });

  it("menu da linha segue as permissões do membro", () => {
    renderTeam();
    fireEvent.click(within(table()).getByRole("button", { name: "Ações de Bruno Lima" }));
    expect(screen.getByRole("menuitem", { name: "Reenviar convite" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Redefinir senha" })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(within(table()).getByRole("button", { name: "Ações de Carla Dias" }));
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toBeDisabled();
    expect(screen.queryByRole("menuitem", { name: /Desativar acesso/ })).not.toBeInTheDocument();
  });

  it("supervisor: sem seleção em lote nem filtro de unidade (papel real, não o diretor)", () => {
    renderTeam("supervisor");
    expect(within(table()).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Filtrar por unidade/ })).not.toBeInTheDocument();
  });

  it("excluir pede a confirmação Lite e chama a mesma ação", async () => {
    renderTeam();
    fireEvent.click(within(table()).getByRole("button", { name: "Ações de Ana Souza" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    const dialog = screen.getByRole("alertdialog", { name: "Excluir membro" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Excluir membro" })); });
    const data = (team.deleteTeamMemberAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("memberId")).toBe("m1");
  });
});

describe("equipe Lite para o gestor no modo normal", () => {
  it("sem Cargos e permissões e convite só de corretores, como a tela de hoje", async () => {
    const { TeamHeaderActionsLite } = await import("./team-lite");
    render(<TeamHeaderActionsLite isDirector={false} branches={[{ id: "b1", name: "Centro" }]} customRoles={[]} />);
    expect(screen.queryByRole("link", { name: "Cargos e permissões" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo funcionário" }));
    expect(screen.getByText("Você pode criar apenas corretores.")).toBeInTheDocument();
  });

  it("a lista segue o papel real do gestor", () => {
    renderTeam("manager");
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent(/painel do diretor/i);
  });
});
