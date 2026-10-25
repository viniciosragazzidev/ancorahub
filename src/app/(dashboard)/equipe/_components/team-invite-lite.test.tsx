// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createTeamUserAction: vi.fn(async () => ({ success: true, token: "tok-1", whatsappStatus: "queued" })),
  importBrokersAction: vi.fn(async () => ({ success: true, report: "3 importados" })),
}));
vi.mock("../actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TeamInviteLite, inviteMessage } from "./team-invite-lite";

afterEach(cleanup);

const branches = [{ id: "11111111-1111-4111-8111-111111111111", name: "Centro" }];

function pick(label: RegExp, option: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("TeamInviteLite", () => {
  it("pede a unidade antes de enviar e manda cargo e perfil coerentes", async () => {
    render(<TeamInviteLite branches={branches} canInviteManager canInviteDirector />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Ana Souza" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Telefone" }), { target: { value: "21999990000" } });
    pick(/^Cargo/, "Gestor");
    expect(screen.getByText("Gestão da unidade")).toBeInTheDocument();
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Criar acesso" }).closest("form")!); });
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha a unidade");
    expect(actions.createTeamUserAction).not.toHaveBeenCalled();
    pick(/^Unidade/, "Centro");
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Criar acesso" }).closest("form")!); });
    const data = (actions.createTeamUserAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("jobTitle")).toBe("manager");
    expect(data.get("role")).toBe("manager");
    expect(data.get("branchId")).toBe(branches[0]!.id);
    expect(await screen.findByText("Convite criado")).toBeInTheDocument();
    expect(screen.getByText(/onboarding\?token=tok-1/)).toBeInTheDocument();
  });

  it("gestor não vê os cargos de diretor e gestor", () => {
    render(<TeamInviteLite branches={branches} canInviteManager={false} />);
    fireEvent.click(screen.getByRole("button", { name: /^Cargo/ }));
    expect(screen.queryByRole("option", { name: "Diretor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Gestor" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Corretor" })).toBeInTheDocument();
  });

  it("mensagem de convite igual à da tela atual", () => {
    expect(inviteMessage("Ana", "https://x/onboarding?token=1")).toContain("Olá, Ana! Seja bem-vindo(a) à nossa equipe.");
  });
});
