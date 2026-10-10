// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ preview: vi.fn(), send: vi.fn(), recipients: vi.fn() }));
vi.mock("../actions", () => ({ previewAudienceAction: actions.preview, sendBroadcastAction: actions.send, broadcastRecipientsAction: actions.recipients }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { RelationshipCenter } from "./relationship-center";

const options = {
  role: "manager" as const,
  brokers: [{ id: "u1", name: "Ana Lima", branchName: "Centro" }, { id: "u2", name: "Bruno Reis", branchName: "Centro" }],
  branches: [{ id: "br1", name: "Centro" }],
  dutyTypes: [],
  supervisors: [],
};

describe("RelationshipCenter", () => {
  beforeEach(() => { Object.values(actions).forEach((fn) => fn.mockReset()); });
  afterEach(cleanup);

  it("counts on the server, asks to confirm and sends only the description of the audience", async () => {
    actions.preview.mockResolvedValue({ ok: true, data: { count: 1, names: ["Ana Lima"], label: "Ana Lima" } });
    actions.send.mockResolvedValue({ ok: true, data: { id: "b1", recipients: 1, label: "Ana Lima" } });
    render(<RelationshipCenter options={options} history={[]} />);

    expect(screen.queryByRole("radio", { name: "Todos" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Ana Lima/ }));
    expect(await screen.findByText(/1 corretor/, {}, { timeout: 3000 })).toBeTruthy();
    expect(actions.preview).toHaveBeenCalledWith({ kind: "people", userIds: ["u1"] });

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Escala publicada" } });
    fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: "Confira seus plantões." } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio para 1" }));
    expect(await screen.findByText(/Enviado para 1 corretor/)).toBeTruthy();
    expect(actions.send).toHaveBeenCalledWith({ kind: "notice", title: "Escala publicada", body: "Confira seus plantões.", audience: { kind: "people", userIds: ["u1"] }, channel: "app" });
  });
});
