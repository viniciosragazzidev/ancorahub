// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), accept: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: mocks.accept }));
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

import { buildLeadNowItems, LightLeadsList, type LightLeadItem } from "./light-leads-list";

const base = { phone: null, createdAt: new Date("2026-10-08T12:00:00Z") };
const leads: LightLeadItem[] = [
  { ...base, id: "n1", name: "Ana Novo", status: "distributed", isAwaitingAcceptance: true },
  { ...base, id: "a1", name: "Bruno Respondeu", status: "in_contact", isAwaitingResponse: true },
  { ...base, id: "a2", name: "Carla Tranquila", status: "negotiation" },
  { ...base, id: "r1", name: "Diego Atrasado", status: "quote_sent", isOverdue: true },
  { ...base, id: "w1", name: "Eva Ganhou", status: "converted" },
  { ...base, id: "l1", name: "Fabio Perdeu", status: "lost", isLost: true },
];

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("LightLeadsList", () => {
  it("shows the top Agora steps in acceptance, reply and overdue return order", () => {
    const now = new Date("2026-10-17T15:00:00-03:00");
    const items = buildLeadNowItems([
      { ...base, id: "r1", name: "Retorno", status: "quote_sent", isOverdueReturn: true, dueAt: new Date("2026-10-17T14:00:00-03:00") },
      { ...base, id: "m1", name: "Respondeu", status: "in_contact", isAwaitingResponse: true, awaitingResponseAt: now },
      { ...base, id: "a1", name: "Aceite", status: "distributed", isAwaitingAcceptance: true, expiresAt: new Date("2026-10-17T15:05:00-03:00"), arrivedAt: now, dutyName: "PRESENCIAL TARDE" },
    ], now);
    expect(items.map((item) => item.kind)).toEqual(["acceptance", "response", "return"]);
  });

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

    expect(screen.getByRole("heading", { name: /Não encontramos nenhum lead com "zzz"/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(within(screen.getByRole("list", { name: "Precisa de você agora" })).getByText("Ana Novo")).toBeTruthy();
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

  it("shows arrival from distribution and takes acceptance straight to the lead", async () => {
    const distributedAt = new Date();
    const lead = { ...base, id: "today", name: "Chegou hoje", status: "distributed", arrivedAt: distributedAt, createdAt: new Date("2020-01-01T10:00:00Z"), isAwaitingAcceptance: true, dutyName: "PRESENCIAL TARDE" };
    mocks.accept.mockResolvedValue({ success: true });
    render(<LightLeadsList leads={[lead]} />);

    const row = screen.getByRole("list", { name: "Precisa de você agora" });
    expect(within(row).getByText(/Recebido hoje/)).toBeTruthy();
    expect(row.textContent).not.toContain("2020");
    expect(within(row).getByText(/PRESENCIAL TARDE/)).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Aceitar lead" })).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "Aceitar lead" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/today"));
  });

  it("orders rows by distribution even when brokerage capture dates are reversed", () => {
    const leads: LightLeadItem[] = [
      { ...base, id: "early", name: "Chegou antes", status: "in_contact", createdAt: new Date("2026-10-17T14:00:00Z"), arrivedAt: new Date("2026-10-15T12:00:00Z") },
      { ...base, id: "late", name: "Chegou depois", status: "in_contact", createdAt: new Date("2026-10-15T12:00:00Z"), arrivedAt: new Date("2026-10-17T12:00:00Z") },
    ];
    render(<LightLeadsList leads={leads} initialFilter="active" />);
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/leads/"));
    expect(links[0]?.textContent).toContain("Chegou depois");
    expect(links[1]?.textContent).toContain("Chegou antes");
  });
});
