// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAddSupervisorNote = vi.hoisted(() => vi.fn());
vi.mock("@/features/supervisor-workspace/notes-actions", () => ({ addSupervisorNoteAction: mockAddSupervisorNote }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/user-avatar", () => ({
  UserAvatar: ({ name }: { name: string }) => <div role="img" aria-label={name}>{name.slice(0, 2)}</div>,
}));

vi.mock("motion/react", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  const components = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const motion = new Proxy({} as typeof actual.motion, {
    get(_target, element: string) {
      if (!components.has(element)) {
        // eslint-disable-next-line react/display-name -- test-only motion stand-in
        components.set(element, React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- motion props are intentionally stripped
          const { animate: _animate, initial: _initial, transition: _transition, ...rest } = props;
          return React.createElement(element, { ...rest, ref });
        }));
      }
      return components.get(element);
    },
  });
  return { ...actual, motion, useReducedMotion: () => true };
});

import { SupervisorBrokerProfile, type SupervisorBrokerProfileProps } from "./supervisor-broker-profile";

const profile: SupervisorBrokerProfileProps = {
  member: {
    userId: "broker-1",
    name: "Ana Souza",
    image: null,
    branchName: "Centro",
    availabilityStatus: "available",
  },
  metrics: { portfolio: 12, inService: 4, withoutFirstContact: 2, sales: 3, overdueTasks: 1 },
  recentLeads: [
    { id: "lead-1", name: "Maria Silva", status: "in_contact", queueName: "PME", assignedAt: "2026-10-10T12:00:00.000Z", createdAt: "2026-10-10T11:00:00.000Z" },
  ],
  whatsappHref: "https://wa.me/5511999999999",
  relationshipHref: "/relacionamento",
  ranking: { medianAcceptSeconds: 80, positions: ["1º nos que mais aceitam"], periodDays: 7 },
  notes: [{ id: "note-1", kind: "orientacao", body: "Retornar o primeiro contato até o fim do dia.", createdAt: "2026-10-10T12:00:00.000Z" }],
};

afterEach(() => cleanup());
beforeEach(() => mockAddSupervisorNote.mockReset());

describe("SupervisorBrokerProfile", () => {
  it("shows the team's broker profile, operational numbers, team ranking and actions", () => {
    render(<SupervisorBrokerProfile {...profile} />);

    expect(screen.getByRole("heading", { name: "Ana Souza" })).toBeTruthy();
    expect(screen.getByText("Centro")).toBeTruthy();
    expect(screen.getByText("Disponível")).toBeTruthy();
    expect(screen.getByText("Carteira").parentElement?.textContent).toContain("12");
    expect(screen.getByText("Em atendimento").parentElement?.textContent).toContain("4");
    expect(screen.getByText("Sem primeiro contato").parentElement?.textContent).toContain("2");
    expect(screen.getByText("Vendas").parentElement?.textContent).toContain("3");
    expect(screen.getByText("Tarefas vencidas").parentElement?.textContent).toContain("1");
    expect(screen.getByText("1 min 20 s")).toBeTruthy();
    expect(screen.getByText("1º nos que mais aceitam")).toBeTruthy();

    const leadLink = screen.getByRole("link", { name: /Maria Silva/ });
    expect(leadLink.getAttribute("href")).toBe("/leads/lead-1");
    expect(within(leadLink).getByText(/Em atendimento/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Chamar no WhatsApp (abre em nova aba)" }).getAttribute("href")).toBe(profile.whatsappHref);
    expect(screen.getByRole("link", { name: "Mandar recado" }).getAttribute("href")).toBe("/relacionamento");
    expect(screen.getByRole("heading", { name: "Feedbacks" })).toBeTruthy();
    expect(screen.getByText("Retornar o primeiro contato até o fim do dia.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("—");
  });

  it("explains unavailable WhatsApp and empty recent leads without dead links", () => {
    render(<SupervisorBrokerProfile {...profile} whatsappHref={null} recentLeads={[]} ranking={null} notes={[]} />);

    expect(screen.queryByRole("link", { name: "Chamar no WhatsApp" })).toBeNull();
    expect(screen.getByText("Telefone não cadastrado para WhatsApp.")).toBeTruthy();
    expect(screen.getByText("Nenhum lead ativo recente.")).toBeTruthy();
    expect(screen.getByText("Sem feedbacks registrados.")).toBeTruthy();
    expect(screen.queryByText("Tempo mediano para aceitar")).toBeNull();
  });

  it("saves a chosen feedback type and adds the confirmed note to the history", async () => {
    mockAddSupervisorNote.mockResolvedValue({
      ok: true,
      note: { id: "note-2", kind: "elogio", body: "Boa condução com a cliente.", createdAt: "2026-10-10T13:00:00.000Z" },
    });
    render(<SupervisorBrokerProfile {...profile} />);

    fireEvent.click(screen.getByRole("button", { name: "Elogio" }));
    fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: "Boa condução com a cliente." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mockAddSupervisorNote).toHaveBeenCalledWith({
      brokerId: "broker-1",
      kind: "elogio",
      body: "Boa condução com a cliente.",
    }));
    expect(await screen.findByText("Feedback salvo.")).toBeTruthy();
    expect(screen.getByText("Boa condução com a cliente.")).toBeTruthy();
  });
});
