// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSave = vi.hoisted(() => vi.fn());
const mockInvite = vi.hoisted(() => vi.fn());
const mockCancel = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());
const mockAddDirectly = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => ({ addBrokerToMyTeamAction: mockAddDirectly }));

vi.mock("./my-team-actions", () => ({
  saveMySupervisorTeamAction: mockSave,
  inviteBrokerToMyTeamAction: mockInvite,
  cancelMyTeamInviteAction: mockCancel,
  removeBrokerFromMyTeamAction: mockRemove,
}));

import { MyTeamPage } from "./my-team-page";

const initialData = {
  team: null,
  members: [],
  invites: [],
  brokers: [{ id: "broker-1", name: "Ana Exemplo", imageUrl: null, supervisorId: null, supervisorName: null, inviteId: null }],
};

beforeEach(() => {
  cleanup();
  mockSave.mockReset();
  mockInvite.mockReset();
  mockCancel.mockReset();
  mockRemove.mockReset();
  mockAddDirectly.mockReset();
});

describe("MyTeamPage", () => {
  it("keeps direct add available and disables invitations before the team profile exists", () => {
    render(<MyTeamPage initialData={initialData} />);
    expect(screen.getByRole("heading", { name: "Crie sua equipe" })).toBeTruthy();
    expect(screen.getByText("Ana Exemplo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Convidar" })).toBeDisabled();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("saves the new team profile and displays confirmation", async () => {
    mockSave.mockResolvedValue({ ok: true, message: "Perfil da equipe salvo." });
    render(<MyTeamPage initialData={initialData} />);
    fireEvent.change(screen.getByLabelText("Nome da equipe"), { target: { value: "Equipe Centro" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Atendimento consultivo." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ name: "Equipe Centro", description: "Atendimento consultivo.", imageUrl: null }));
    expect(await screen.findByText("Perfil da equipe salvo.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Equipe Centro" })).toBeTruthy();
  });

  it("offers direct add and consent-based invite for each free broker", () => {
    render(<MyTeamPage initialData={{ ...initialData, team: { name: "Equipe Centro", description: "", imageUrl: null } }} />);
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Convidar" })).toBeEnabled();
  });

  it("keeps the direct add wired to the existing P2 action", async () => {
    mockAddDirectly.mockResolvedValue({ ok: false, message: "Não foi possível adicionar." });
    render(<MyTeamPage initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(mockAddDirectly).toHaveBeenCalledWith("broker-1"));
  });
});
