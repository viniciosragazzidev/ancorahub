// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ preview: vi.fn(), send: vi.fn(), recipients: vi.fn() }));
vi.mock("../actions", () => ({ previewAudienceAction: actions.preview, sendBroadcastAction: actions.send, broadcastRecipientsAction: actions.recipients }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: ({ open, title, children }: { open?: boolean; title: string; children: React.ReactNode }) => open ? <section aria-label={title}>{children}</section> : null }));

import { RelationshipCenterLite } from "./relationship-center-lite";

const options = {
  role: "supervisor" as const,
  brokers: [{ id: "u1", name: "Ana Lima", branchId: "br1", branchName: "Centro", supervisorId: "s1" }, { id: "u2", name: "Bruno Reis", branchId: "br1", branchName: "Centro", supervisorId: "s1" }],
  branches: [{ id: "br1", name: "Centro" }],
  dutyTypes: [],
  supervisors: [],
} as never;

afterEach(() => cleanup());

describe("RelationshipCenterLite", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.values(actions).forEach((fn) => fn.mockReset());
    actions.preview.mockResolvedValue({ ok: true, data: { count: 2, names: ["Ana Lima", "Bruno Reis"] } });
  });

  it("starts on the team, shows who receives and asks to confirm before sending", async () => {
    actions.send.mockResolvedValue({ ok: true, data: { recipients: 2, label: "Equipe" } });
    render(<RelationshipCenterLite options={options} history={[]} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText("2 corretores")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Reunião amanhã" } });
    fireEvent.change(screen.getByLabelText("Texto"), { target: { value: "Às 9h na unidade." } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar recado" }));
    expect(actions.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio para 2" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(actions.send).toHaveBeenCalledWith(expect.objectContaining({ audience: { kind: "team" }, title: "Reunião amanhã" }));
  });

  it("opens with the broker chosen from a shortcut and as a recognition", () => {
    render(<RelationshipCenterLite options={options} history={[]} initialBrokerId="u2" initialKind="recognition" />);
    expect(screen.getByRole("button", { name: "Tirar Bruno Reis" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Bruno Reis/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("lists sent messages with read progress", () => {
    render(<RelationshipCenterLite options={options} history={[{ id: "b1", kind: "notice", title: "Escala publicada", body: "Veja a escala.", audienceLabel: "Equipe", senderName: "Sup", requireAck: false, recipientsCount: 4, read: 3, acked: 0, createdAt: "2026-10-10T12:00:00.000Z" } as never]} />);
    fireEvent.click(screen.getByRole("button", { name: /Enviados/ }));
    expect(screen.getByText("Escala publicada")).toBeTruthy();
    expect(screen.getByText("3 de 4 leram")).toBeTruthy();
  });
});
