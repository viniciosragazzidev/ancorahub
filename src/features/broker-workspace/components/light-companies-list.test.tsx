// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/arc/animated-counter/animated-counter", () => ({ AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span role="img" aria-label={name} /> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title, description }: { title: string; description: string }) => <section><h3>{title}</h3><p>{description}</p></section> }));
vi.mock("@/components/arc/search-field/search-field", () => ({
  SearchField: ({ label, value, onValueChange }: { label: string; value: string; onValueChange: (value: string) => void }) => (
    <input aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));
vi.mock("@/components/chat/assistant-avatar", () => ({ AssistantAvatar: () => null }));
vi.mock("@/components/light/light-motion", () => ({
  LitePageEnter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LiteList: ({ children, label }: { children: ReactNode; label?: string }) => <ul aria-label={label}>{children}</ul>,
  LiteListItem: ({ children }: { children: ReactNode }) => <li>{children}</li>,
}));

import { LightCompaniesList, type LightCompanyItem } from "./light-companies-list";

const companies: LightCompanyItem[] = [
  { id: "c1", name: "Padaria Central Ltda", cnpj: "12345678000190", employeeCount: 12, branchName: "Central", leadCount: 3 },
  { id: "c2", name: "Oficina do Norte", cnpj: null, employeeCount: null, branchName: "Central", leadCount: 1 },
];

afterEach(() => cleanup());

describe("LightCompaniesList", () => {
  it("shows the unit's companies with their lead counts", () => {
    render(<LightCompaniesList companies={companies} />);

    expect(screen.getByRole("heading", { level: 1, name: "Empresas" })).toBeTruthy();
    expect(screen.getByText("3 leads")).toBeTruthy();
    expect(screen.getByText("1 lead")).toBeTruthy();
    expect(screen.getByText("CNPJ não informado")).toBeTruthy();
  });

  it("filters by name or CNPJ", () => {
    render(<LightCompaniesList companies={companies} />);
    fireEvent.change(screen.getByLabelText("Buscar empresa"), { target: { value: "norte" } });

    expect(screen.queryByText("Padaria Central Ltda")).toBeNull();
    expect(screen.getByText("Oficina do Norte")).toBeTruthy();
  });

  it("explains an empty portfolio", () => {
    render(<LightCompaniesList companies={[]} />);
    expect(screen.getByRole("heading", { name: "Nenhuma empresa ainda" })).toBeTruthy();
  });
});
