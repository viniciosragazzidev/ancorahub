// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; loading?: boolean }) => {
    const { variant, loading, ...buttonProps } = props;
    return <button data-variant={variant} aria-busy={loading || undefined} {...buttonProps}>{children}</button>;
  },
}));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/search-field/search-field", () => ({
  SearchField: ({ label, value, onValueChange, ...props }: { label: string; value: string; onValueChange: (value: string) => void } & InputHTMLAttributes<HTMLInputElement>) => <label>{label}<input type="search" aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} {...props} /></label>,
}));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ trigger, title, children }: { trigger: ReactNode; title: string; children: ReactNode }) => <section><div>{trigger}</div><h2>{title}</h2>{children}</section>,
}));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({
  default: ({ options, value, onValueChange, label }: { options: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void; label: string }) => <div role="group" aria-label={label}>{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onValueChange(option.value)}>{option.label}</button>)}</div>,
}));
vi.mock("@/components/ui/select", () => ({
  AppSelect: ({ options, name, defaultValue, "aria-label": ariaLabel }: { options: { value: string; label: string }[]; name: string; defaultValue?: string; "aria-label": string }) => <select aria-label={ariaLabel} name={name} defaultValue={defaultValue}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}));

import type { BrokerClientWalletFilters, BrokerClientWalletResult } from "@/features/customers/broker-client-wallet";
import { BrokerClientWallet } from "./broker-client-wallet";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const filters: BrokerClientWalletFilters = {
  view: "all",
  page: 2,
  query: "Ana",
  origin: "manual",
  contractStatus: "active",
  returnStatus: "today",
};

const wallet: BrokerClientWalletResult = {
  rows: [{
    id: "client-a",
    leadId: "lead-a",
    name: "Ana Souza",
    phone: "5511999999999",
    email: null,
    convertedAt: new Date("2026-11-10T12:00:00.000Z"),
    origin: "manual",
    contractStatus: "active",
    renewalWindowStartDate: "2026-11-20",
    nextTask: { id: "task-a", title: "Revisar proposta", dueAt: new Date("2026-11-11T14:00:00.000Z"), priority: "normal" },
    attentionReason: "today_return",
  }],
  page: 2,
  pageSize: 20,
  totalPages: 3,
  totalCount: 41,
  walletCount: 41,
  counts: { all: 41, attention: 8, renewals: 3 },
  hasRenewalData: true,
  origins: ["manual", "webhook"],
};

describe("broker client wallet UI contract", () => {
  it("keeps the URL filters while changing recut and resets the page", () => {
    render(<BrokerClientWallet wallet={wallet} filters={filters} />);
    fireEvent.click(screen.getByRole("button", { name: "Precisa de atenção" }));
    expect(push).toHaveBeenCalledWith("/clientes?view=attention&page=1&q=Ana&origin=manual&contract=active&return=today");
  });

  it("renders a GET search, real filter options, the next action and restorable detail links", () => {
    render(<BrokerClientWallet wallet={wallet} filters={filters} />);

    const search = screen.getByRole("searchbox", { name: "Buscar cliente" });
    expect(search).toHaveAttribute("name", "q");
    expect(search).toHaveValue("Ana");
    expect(search.closest("form")).toHaveAttribute("method", "get");
    expect(screen.getByRole("combobox", { name: "Situação do contrato" })).toHaveValue("active");
    expect(screen.getByLabelText("Origem do lead")).toHaveValue("manual");
    expect(screen.getByText("Retorno hoje")).toBeInTheDocument();
    expect(screen.getByText(/Próxima ação: Revisar proposta/)).toBeInTheDocument();

    const details = screen.getByRole("link", { name: /Ana Souza/ });
    expect(details.getAttribute("href")).toContain("/clientes/client-a?back=");
    expect(decodeURIComponent(details.getAttribute("href") ?? "")).toContain("view=all&page=2&q=Ana&origin=manual&contract=active&return=today");
    expect(screen.getByRole("link", { name: "Próxima" }).getAttribute("href")).toContain("page=3");
  });

  it("separates an empty wallet from a filtered empty result", () => {
    const emptyWallet = { ...wallet, rows: [], walletCount: 0, totalCount: 0, totalPages: 0 };
    const { rerender } = render(<BrokerClientWallet wallet={emptyWallet} filters={{ view: "all", page: 1 }} />);
    expect(screen.getByRole("heading", { name: "Sua carteira ainda está vazia" })).toBeInTheDocument();

    rerender(<BrokerClientWallet wallet={{ ...emptyWallet, walletCount: 12 }} filters={{ view: "all", page: 1, query: "ninguém" }} />);
    expect(screen.getByRole("heading", { name: "Nenhum cliente encontrado" })).toBeInTheDocument();
  });
});
