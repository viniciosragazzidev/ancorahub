// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAccept = vi.hoisted(() => vi.fn());
const mockDecline = vi.hoisted(() => vi.fn());

vi.mock("@/features/supervisor-workspace/my-team-actions", () => ({
  acceptSupervisorTeamInviteAction: mockAccept,
  declineSupervisorTeamInviteAction: mockDecline,
}));

import { SupervisorTeamInvites } from "./supervisor-team-invites";

beforeEach(() => {
  cleanup();
  mockAccept.mockReset();
  mockDecline.mockReset();
});

describe("SupervisorTeamInvites", () => {
  it("lets the broker accept a pending invite and clears it after success", async () => {
    mockAccept.mockResolvedValue({ ok: true, message: "Você entrou na equipe." });
    render(<SupervisorTeamInvites initialInvites={[{ id: "invite-1", teamName: "Equipe Norte", teamImageUrl: null, createdAt: "2026-10-10T12:00:00.000Z", message: null }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith("invite-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Você entrou na equipe.");
    await waitFor(() => expect(screen.queryByText("Equipe Equipe Norte")).toBeNull());
  });

  it("shows the team identity even without pending invitations", () => {
    render(<SupervisorTeamInvites initialInvites={[]} teamIdentity={{ name: "Equipe Centro", imageUrl: null }} />);
    expect(screen.getByRole("heading", { name: "Sua equipe" })).toBeTruthy();
    expect(screen.getByText("Equipe Centro")).toBeTruthy();
  });
});
