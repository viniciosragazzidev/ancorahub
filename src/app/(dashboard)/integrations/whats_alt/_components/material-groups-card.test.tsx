// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaterialGroupsCard, type MaterialGroupActions, type MaterialGroupRow } from "./material-groups-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

const groups: MaterialGroupRow[] = [
  { id: "g1", groupId: "111", groupName: "Unimed Corretores", active: true },
  { id: "g2", groupId: "222", groupName: "Cotação Amil", active: false },
  { id: "g3", groupId: "333", groupName: null, active: false },
];

function actions(overrides: Partial<MaterialGroupActions> = {}): MaterialGroupActions {
  return {
    refresh: vi.fn(async () => ({ success: true as const, groupsFound: 3 })),
    toggle: vi.fn(async () => ({ success: true as const })),
    ...overrides,
  };
}

describe("MaterialGroupsCard", () => {
  it("asks to connect the number first and keeps the refresh button off", () => {
    render(<MaterialGroupsCard groups={[]} channelReady={false} actions={actions()} />);

    expect(screen.getByText(/Conecte o número acima/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Atualizar lista de grupos" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("invites the first listing when the number is connected but no group is known", () => {
    render(<MaterialGroupsCard groups={[]} channelReady actions={actions()} />);

    expect(screen.getByText(/Nenhum grupo listado ainda/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Atualizar lista de grupos" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows only the active groups when there are some, and all of them on request", () => {
    render(<MaterialGroupsCard groups={groups} channelReady actions={actions()} />);

    expect(screen.getByText("Unimed Corretores")).toBeTruthy();
    expect(screen.queryByText("Cotação Amil")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos" }));
    expect(screen.getByText("Cotação Amil")).toBeTruthy();
    expect(screen.getByText("Grupo sem nome")).toBeTruthy();
  });

  it("shows every group when none is active yet, so there is something to pick", () => {
    render(
      <MaterialGroupsCard groups={groups.map((group) => ({ ...group, active: false }))} channelReady actions={actions()} />,
    );

    expect(screen.getByText("Unimed Corretores")).toBeTruthy();
    expect(screen.getByText("Cotação Amil")).toBeTruthy();
  });

  it("searches without caring about accents or case", () => {
    render(<MaterialGroupsCard groups={groups.map((group) => ({ ...group, active: false }))} channelReady actions={actions()} />);

    fireEvent.change(screen.getByLabelText("Buscar grupo"), { target: { value: "COTACAO" } });
    expect(screen.getByText("Cotação Amil")).toBeTruthy();
    expect(screen.queryByText("Unimed Corretores")).toBeNull();
  });

  it("activates a group through the action", async () => {
    const toggle = vi.fn(async () => ({ success: true as const }));
    render(<MaterialGroupsCard groups={groups} channelReady actions={actions({ toggle })} />);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Ativar Cotação Amil" }));

    await waitFor(() => expect(toggle).toHaveBeenCalledWith({ id: "g2", active: true }));
  });

  it("deactivates an active group through the action", async () => {
    const toggle = vi.fn(async () => ({ success: true as const }));
    render(<MaterialGroupsCard groups={groups} channelReady actions={actions({ toggle })} />);

    fireEvent.click(screen.getByRole("button", { name: "Desativar Unimed Corretores" }));

    await waitFor(() => expect(toggle).toHaveBeenCalledWith({ id: "g1", active: false }));
  });

  it("reads the groups of the number when asked", async () => {
    const refresh = vi.fn(async () => ({ success: true as const, groupsFound: 3 }));
    render(<MaterialGroupsCard groups={[]} channelReady actions={actions({ refresh })} />);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar lista de grupos" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
