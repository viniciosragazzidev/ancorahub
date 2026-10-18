// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvite = vi.hoisted(() => vi.fn());
const mockCancel = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());
const mockAddDirectly = vi.hoisted(() => vi.fn());
const mockResendAccessInvite = vi.hoisted(() => vi.fn());
const mockRevokeAccessInvite = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ addBrokerToMyTeamAction: mockAddDirectly }));
vi.mock("./my-team-actions", () => ({ inviteBrokerToMyTeamAction: mockInvite, cancelMyTeamInviteAction: mockCancel, removeBrokerFromMyTeamAction: mockRemove }));
vi.mock("@/app/(dashboard)/equipe/actions", () => ({ resendInviteAction: mockResendAccessInvite, revokeInviteAction: mockRevokeAccessInvite }));
vi.mock("@/features/team/team-invite-lite-sheet", () => ({ TeamInviteLiteSheet: () => <button type="button">Convidar corretor</button> }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/chat/assistant-avatar", () => ({ AssistantAvatar: () => <span data-testid="team-mascot" /> }));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span role="img" aria-label={name}>{name.slice(0, 1)}</span> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({ default: ({ options, value, onValueChange, label }: { options: Array<{ value: string; label: string; accessory?: React.ReactNode }>; value: string; onValueChange: (value: string) => void; label: string }) => <div role="group" aria-label={label}>{options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onValueChange(option.value)}>{option.label}{option.accessory}</button>)}</div> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title, description, action, icon }: { title: string; description: string; action?: React.ReactNode; icon?: React.ReactNode }) => <section><h2>{title}</h2><p>{description}</p>{icon}{action}</section> }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: ({ trigger, title, children }: { trigger: React.ReactNode; title: string; children: React.ReactNode }) => <div><div>{trigger}</div><h3>{title}</h3>{children}</div> }));

import { MyTeamPage, teamAvatarHue } from "./my-team-page";

const base = { branchId: "branch-1", branchName: "Centro", overview: { brokers: 0, inService: 0, late: 0 }, ranking: null, team: null, members: [], invites: [], pendingAccessInvites: [], brokers: [{ id: "broker-1", name: "Ana Exemplo", imageUrl: null, supervisorId: null, supervisorName: null, inviteId: null }] };

beforeEach(() => { cleanup(); mockInvite.mockReset(); mockCancel.mockReset(); mockRemove.mockReset(); mockAddDirectly.mockReset(); mockResendAccessInvite.mockReset(); mockRevokeAccessInvite.mockReset(); });

describe("MyTeamPage", () => {
  it("shows the illustrated empty state and keeps setup outside the team page", () => {
    render(<MyTeamPage initialData={base} />);
    expect(screen.getByRole("heading", { name: "Minha equipe" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sua equipe começa com um bom plano" })).toBeTruthy();
    expect(screen.getAllByTestId("team-mascot")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Criar minha equipe" }).getAttribute("href")).toBe("/equipe/minha/configurar");
    expect(screen.queryByLabelText("Nome da equipe")).toBeNull();
    expect(screen.queryByLabelText("Descrição")).toBeNull();
  });

  it("opens unit members and keeps direct add and invitation as distinct choices", () => {
    render(<MyTeamPage initialData={{ ...base, team: { name: "Equipe Centro", description: "Atendimento consultivo", imageUrl: null } }} />);
    fireEvent.click(screen.getByRole("button", { name: /Unidade/ }));
    expect(screen.getByText("Ana Exemplo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Convidar" })).toBeEnabled();
  });

  it("keeps direct add wired to the existing P2 action", async () => {
    mockAddDirectly.mockResolvedValue({ ok: false, message: "Não foi possível adicionar." });
    render(<MyTeamPage initialData={{ ...base, team: { name: "Equipe Centro", description: "", imageUrl: null } }} />);
    fireEvent.click(screen.getByRole("button", { name: /Unidade/ }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(mockAddDirectly).toHaveBeenCalledWith("broker-1"));
  });

  it("derives a stable non-neutral hue from the member name", () => {
    expect(teamAvatarHue("Ana Souza")).toBe(teamAvatarHue("Ana Souza"));
    expect(teamAvatarHue("Ana Souza")).not.toBe(teamAvatarHue("Bruno Lima"));
  });

  it("shows the unit position and weekly movement only when the ranking is available", () => {
    render(<MyTeamPage initialData={{ ...base, team: { name: "Equipe Centro", description: "", imageUrl: null }, ranking: { position: 2, positionChange: 1 } }} />);
    expect(screen.getByText(/Sua equipe está em/).textContent).toContain("Nº 2");
    expect(screen.getByLabelText("Subiu 1 posições")).toBeTruthy();
  });
});

describe("MyTeamPage pending first-access invitations", () => {
  it("keeps resend scoped to the pending invitation id", async () => {
    mockResendAccessInvite.mockResolvedValue({ success: false, error: "Sem WhatsApp disponível." });
    render(<MyTeamPage initialData={{ ...base, pendingAccessInvites: [{ id: "invite-42", brokerProfileId: "profile-42", brokerName: "Caio Lima", email: "caio@example.com", createdAt: "2026-10-14T12:00:00.000Z" }] }} />);
    fireEvent.click(screen.getByRole("button", { name: /Convites/ }));
    expect(screen.getByText(/caio@example.com/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    await waitFor(() => expect(mockResendAccessInvite).toHaveBeenCalledTimes(1));
    expect(mockResendAccessInvite.mock.calls[0][1].get("invitationId")).toBe("invite-42");
  });
});
