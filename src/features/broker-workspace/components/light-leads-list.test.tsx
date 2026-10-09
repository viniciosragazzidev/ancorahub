// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: vi.fn() }));
vi.mock("@/features/broker-workspace/components/light-availability-banner", () => ({ LightAvailabilityBanner: () => null }));
// Arc components drive Motion springs that the global jsdom mock of motion/react does not implement.
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span role="img" aria-label={name} /> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
}));
vi.mock("@/components/arc/empty-state/empty-state", () => ({
  EmptyState: ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
    <section aria-label="Lista vazia"><h3>{title}</h3><p>{description}</p>{action}</section>
  ),
}));
vi.mock("@/components/arc/search-field/search-field", () => ({
  SearchField: ({ label, value, onValueChange }: { label: string; value: string; onValueChange: (value: string) => void }) => (
    <input aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({
  default: ({ options, value, onValueChange }: { options: { value: string; label: string; accessory?: ReactNode }[]; value: string; onValueChange: (value: string) => void }) => (
    <div role="group" aria-label="Etapas da fila">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onValueChange(option.value)}>
          {option.label}{option.accessory}
        </button>
      ))}
    </div>
  ),
}));

import { LightLeadsList, type LightLeadItem } from "./light-leads-list";

const base = { phone: null, createdAt: new Date("2026-10-08T12:00:00Z") };
const leads: LightLeadItem[] = [
  { ...base, id: "n1", name: "Ana Novo", status: "distributed", isAwaitingAcceptance: true },
  { ...base, id: "a1", name: "Bruno Respondeu", status: "in_contact", isAwaitingResponse: true },
  { ...base, id: "a2", name: "Carla Tranquila", status: "negotiation" },
  { ...base, id: "r1", name: "Diego Atrasado", status: "quote_sent", isOverdue: true },
  { ...base, id: "w1", name: "Eva Ganhou", status: "converted" },
  { ...base, id: "l1", name: "Fabio Perdeu", status: "lost", isLost: true },
];

afterEach(() => cleanup());

describe("LightLeadsList", () => {
  it("opens on Novos with the new lead as a large card with the accept action", () => {
    render(<LightLeadsList leads={leads} />);

    const group = screen.getByRole("region", { name: /Precisa de você agora/ });
    expect(within(group).getByText("Ana Novo")).toBeTruthy();
    expect(within(group).getByRole("button", { name: "Aceitar lead" })).toBeTruthy();
    expect(screen.queryByText("Carla Tranquila")).toBeNull();
  });

  it("splits Atendendo into the group that needs the broker and the compact rest", () => {
    render(<LightLeadsList leads={leads} />);
    fireEvent.click(screen.getByRole("button", { name: /^Atendendo/ }));

    const group = screen.getByRole("region", { name: /Precisa de você agora/ });
    expect(within(group).getByText("Bruno Respondeu")).toBeTruthy();
    expect(within(group).queryByText("Carla Tranquila")).toBeNull();
    const rest = screen.getByRole("region", { name: "Demais atendimentos" });
    expect(within(rest).getByText("Carla Tranquila")).toBeTruthy();
  });

  it("lists overdue leads in Retornos and won and lost leads in Fechados", () => {
    render(<LightLeadsList leads={leads} />);

    fireEvent.click(screen.getByRole("button", { name: /^Retornos/ }));
    expect(screen.getByText("Diego Atrasado")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Fechados/ }));
    expect(screen.getByText("Eva Ganhou")).toBeTruthy();
    expect(screen.getByText("Fabio Perdeu")).toBeTruthy();
  });

  it("shows the empty state of the tab when there is nothing to list", () => {
    render(<LightLeadsList leads={[]} />);
    expect(screen.getByRole("heading", { name: "Nenhum atendimento em andamento" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Retornos/ }));
    expect(screen.getByRole("heading", { name: "Nenhum retorno pendente" })).toBeTruthy();
  });

  it("filters by name and offers to clear the search", () => {
    render(<LightLeadsList leads={leads} />);
    fireEvent.change(screen.getByLabelText("Buscar lead"), { target: { value: "zzz" } });

    expect(screen.getByRole("heading", { name: /Nenhum resultado para "zzz"/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(screen.getByText("Ana Novo")).toBeTruthy();
  });

  it("adds an Em risco tab with every lead at SLA risk, accepted ones included", () => {
    const withRisk: LightLeadItem[] = [
      ...leads,
      { ...base, id: "k1", name: "Gabi Sem Contato", status: "in_contact", isSlaAtRisk: true },
    ];
    render(<LightLeadsList leads={withRisk} />);

    fireEvent.click(screen.getByRole("button", { name: /^Em risco/ }));
    const group = screen.getByRole("region", { name: /Precisa de você agora/ });
    expect(within(group).getByText("Gabi Sem Contato")).toBeTruthy();
    expect(within(group).getByText("Prazo em risco")).toBeTruthy();
    expect(screen.queryByText("Carla Tranquila")).toBeNull();
  });

  it("hides the Em risco tab when nothing is at risk", () => {
    render(<LightLeadsList leads={leads} />);
    expect(screen.queryByRole("button", { name: /^Em risco/ })).toBeNull();
  });
});
