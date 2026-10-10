// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ ack: vi.fn(), read: vi.fn() }));
vi.mock("../actions", () => ({ acknowledgeAction: actions.ack, markInboxReadAction: actions.read }));

import { BrokerMural } from "./broker-mural";

const item = (overrides = {}) => ({ id: "b1", kind: "confirmation" as const, title: "Escala publicada", body: "Confira seus plantões.", requireAck: true, createdAt: "2026-10-10T12:00:00Z", senderName: "Keyla", readAt: null, ackAt: null, ...overrides });

describe("BrokerMural", () => {
  beforeEach(() => { actions.ack.mockReset(); actions.read.mockReset(); });
  afterEach(cleanup);

  it("marks the new messages read on open and confirms with Ciente", async () => {
    actions.ack.mockResolvedValue({ ok: true, data: 1 });
    render(<BrokerMural items={[item()]} />);
    expect(actions.read).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Ciente" }));
    expect(await screen.findByText(/Você confirmou em/)).toBeTruthy();
    expect(actions.ack).toHaveBeenCalledWith("b1");
  });

  it("does not mark anything when all was read and shows the empty state", () => {
    const { unmount } = render(<BrokerMural items={[item({ readAt: "2026-10-10T12:01:00Z", requireAck: false, kind: "notice" })]} />);
    expect(actions.read).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Ciente" })).toBeNull();
    unmount();
    render(<BrokerMural items={[]} />);
    expect(screen.getByText(/Nenhuma mensagem por enquanto/)).toBeTruthy();
  });
});
