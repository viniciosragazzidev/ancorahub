// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Arc components drive Motion springs that the global jsdom mock of motion/react does not implement.
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span role="img" aria-label={name} /> }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));
vi.mock("@/components/arc/empty-state/empty-state", () => ({
  EmptyState: ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
    <section><h3>{title}</h3><p>{description}</p>{action}</section>
  ),
}));
vi.mock("@/components/arc/search-field/search-field", () => ({
  SearchField: ({ label, value, onValueChange }: { label: string; value: string; onValueChange: (value: string) => void }) => (
    <input aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));

vi.mock("@/components/arc/animated-counter/animated-counter", () => ({ AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span> }));

import { LightClientsList, type LightClientItem } from "./light-clients-list";

const clients: LightClientItem[] = [
  { id: "c1", name: "Marina Alves", phone: "11999998888", email: null, convertedAt: "2026-09-20T12:00:00Z" },
  { id: "c2", name: "Paulo Dias", phone: null, email: null, convertedAt: "2026-09-22T12:00:00Z" },
];

afterEach(() => cleanup());

describe("LightClientsList", () => {
  it("counts the clients, keeps the screen title only for assistive tech and links each row", () => {
    render(<LightClientsList clients={clients} />);

    expect(screen.getByText("2 clientes conquistados")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Clientes" }).className).toContain("sr-only");
    expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toContain("web.whatsapp.com/send?phone=");
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/clientes/"))).toHaveLength(2);
  });

  it("offers WhatsApp only to clients with a phone", () => {
    render(<LightClientsList clients={clients} />);
    expect(screen.getAllByRole("link", { name: "WhatsApp" })).toHaveLength(1);
  });

  it("filters by name and clears the search from the empty state", () => {
    render(<LightClientsList clients={clients} />);
    fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "zzz" } });

    expect(screen.getByRole("heading", { name: /Nenhum resultado para "zzz"/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(screen.getByText("Marina Alves")).toBeTruthy();
  });

  it("explains how a client appears when there are none", () => {
    render(<LightClientsList clients={[]} />);
    expect(screen.getByRole("heading", { name: "Nenhum cliente ainda" })).toBeTruthy();
  });

  it("shows the big title and the count blocks only on the management screen", () => {
    const { unmount } = render(<LightClientsList clients={clients} />);
    expect(screen.getByRole("heading", { level: 1, name: "Clientes" }).className).toContain("sr-only");
    unmount();

    render(<LightClientsList clients={clients} management />);
    expect(screen.getByRole("heading", { level: 1, name: "Clientes" }).className).not.toContain("sr-only");
    expect(screen.getByText("Corretores com clientes")).toBeTruthy();
  });

  it("filters the management list by contract status and shows the status pill", () => {
    const withStatus: LightClientItem[] = [
      { ...clients[0], status: "active" },
      { ...clients[1], status: "cancelled" },
    ];
    render(<LightClientsList clients={withStatus} management />);

    expect(screen.getAllByText("Cliente ativo").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /Cancelados/ }));
    expect(screen.queryByText("Marina Alves")).toBeNull();
    expect(screen.getByText("Paulo Dias")).toBeTruthy();
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/clientes/"))).toHaveLength(1);
  });
});
