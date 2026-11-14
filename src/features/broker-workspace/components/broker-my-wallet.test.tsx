// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; loading?: boolean; size?: string }) => {
    const { variant, loading, size, ...buttonProps } = props;
    void size;
    return <button data-variant={variant} aria-busy={loading || undefined} {...buttonProps}>{children}</button>;
  },
}));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/search-field/search-field", () => ({
  SearchField: ({ label, value, onValueChange, clearLabel, ...props }: { label: string; value: string; clearLabel?: string; onValueChange: (value: string) => void } & InputHTMLAttributes<HTMLInputElement>) => {
    void clearLabel;
    return <label>{label}<input type="search" aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} {...props} /></label>;
  },
}));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ trigger, title, children, open }: { trigger?: ReactNode; title: string; children: ReactNode; open?: boolean }) => (
    <section aria-label={title} data-open={open === undefined ? undefined : String(open)}><div>{trigger}</div><h2>{title}</h2>{children}</section>
  ),
}));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({
  default: ({ options, value, onValueChange, label }: { options: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void; label: string }) => <div role="group" aria-label={label}>{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onValueChange(option.value)}>{option.label}</button>)}</div>,
}));
vi.mock("@/components/arc/input/input", () => ({
  Input: ({ label, error, description, ...props }: { label: string; error?: string; description?: string } & InputHTMLAttributes<HTMLInputElement>) => {
    void description;
    return <label>{label}<input aria-label={label} {...props} />{error ? <span role="alert">{error}</span> : null}</label>;
  },
}));
vi.mock("@/components/arc/textarea/textarea", () => ({
  Textarea: ({ label, error, description, ...props }: { label: string; error?: string; description?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) => {
    void description;
    return <label>{label}<textarea aria-label={label} {...props} />{error ? <span role="alert">{error}</span> : null}</label>;
  },
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, id }: { checked: boolean; onCheckedChange: (checked: boolean) => void; id?: string }) => (
    <input type="checkbox" id={id} checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
  ),
}));
vi.mock("@/components/ui/select", () => ({
  AppSelect: ({ options, name, defaultValue, "aria-label": ariaLabel }: { options: { value: string; label: string }[]; name: string; defaultValue?: string; "aria-label": string }) => <select aria-label={ariaLabel} name={name} defaultValue={defaultValue}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}));

import type { BrokerClientWalletResult } from "@/features/customers/broker-client-wallet";
import { normalizeBrokerWalletFilters } from "@/features/customers/broker-wallet-filters";
import type { BrokerWalletLeadsResult } from "@/features/customers/broker-wallet-leads";

import { BrokerMyWallet } from "./broker-my-wallet";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const counts = { negotiating: 12, all: 30, attention: 4, archived: 2 };

const leads: BrokerWalletLeadsResult = {
  view: "negotiating",
  rows: [{
    id: "lead-a",
    name: "Bruna Lima",
    phone: "5511988887777",
    status: "quote_sent",
    origin: "manual",
    archived: false,
    updatedAt: new Date("2026-11-12T12:00:00.000Z"),
    nextTask: { id: "task-a", title: "Ligar de novo", dueAt: new Date("2026-11-13T14:00:00.000Z") },
  }],
  page: 1,
  pageSize: 20,
  totalPages: 2,
  totalCount: 21,
  counts: { negotiating: 12, archived: 2 },
  origins: ["manual"],
};

const clients: BrokerClientWalletResult = {
  filters: { view: "all", page: 1 },
  rows: [{
    id: "client-a",
    leadId: "lead-c",
    name: "Carlos Melo",
    phone: "5511977776666",
    email: null,
    convertedAt: new Date("2026-11-10T12:00:00.000Z"),
    origin: "webhook",
    contractStatus: "active",
    renewalWindowStartDate: null,
    nextTask: null,
    attentionReason: null,
  }],
  page: 1,
  pageSize: 20,
  totalPages: 1,
  totalCount: 1,
  walletCount: 30,
  counts: { all: 30, attention: 4, renewals: 0 },
  hasRenewalData: false,
  origins: ["webhook"],
};

describe("Minha carteira", () => {
  it("mostra as quatro visões na ordem do plano, com contagens, e troca mantendo busca e origem", () => {
    const filters = normalizeBrokerWalletFilters({ view: "negotiating", query: "Bru", origin: "manual", stage: "quote_sent" });
    render(<BrokerMyWallet filters={filters} counts={counts} origins={["manual", "webhook"]} leads={leads} />);

    const group = screen.getByRole("group", { name: "Visões da carteira" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["Em negociação", "Clientes", "Precisa de atenção", "Arquivados"]);
    expect(screen.getByRole("heading", { level: 1, name: "Minha carteira" })).toBeTruthy();
    expect(screen.getByText("12 em negociação · 30 clientes")).toBeTruthy();

    fireEvent.click(within(group).getByRole("button", { name: "Clientes" }));
    expect(push).toHaveBeenCalledWith("/clientes?view=all&page=1&q=Bru&origin=manual");
  });

  it("Em negociação: cada linha abre a conversa do lead e mostra a etapa e a próxima ação", () => {
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({ view: "negotiating" })} counts={counts} origins={["manual"]} leads={leads} />);
    const link = screen.getAllByRole("link", { name: /Bruna Lima/ }).find((item) => !item.getAttribute("aria-label"))!;
    expect(link.getAttribute("href")).toBe("/leads/lead-a");
    expect(within(screen.getByRole("list", { name: "Contatos em negociação" })).getByText("Cotação enviada")).toBeTruthy();
    expect(screen.getByText(/Próxima ação: Ligar de novo/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "WhatsApp de Bruna Lima" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Próxima" }).getAttribute("href")).toBe("/clientes?view=negotiating&page=2");
  });

  it("Clientes: cada linha abre o perfil do cliente", () => {
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({ view: "all" })} counts={counts} origins={["webhook"]} clients={clients} />);
    expect(screen.getAllByRole("link", { name: /Carlos Melo/ }).find((item) => !item.getAttribute("aria-label"))!.getAttribute("href")).toBe("/clientes/client-a");
    expect(screen.getByText("Contrato ativo")).toBeTruthy();
  });

  it("filtro de situação muda com a visão e a origem é um campo separado", () => {
    const { unmount } = render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({ view: "negotiating" })} counts={counts} origins={["manual", "webhook"]} leads={leads} />);
    const situation = screen.getByRole("combobox", { name: "Situação" });
    expect(within(situation).getAllByRole("option").map((option) => option.textContent)).toContain("Em atendimento");
    expect(screen.getByRole("combobox", { name: "Origem" })).toBeTruthy();
    unmount();

    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({ view: "archived" })} counts={counts} origins={["manual"]} leads={{ ...leads, view: "archived", rows: [] }} />);
    expect(within(screen.getByRole("combobox", { name: "Situação" })).getAllByRole("option").map((option) => option.textContent)).toEqual(["Qualquer situação", "Perdido", "Arquivado"]);
    cleanup();

    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({ view: "attention" })} counts={counts} origins={["manual"]} clients={{ ...clients, rows: [] }} />);
    expect(screen.getByRole("combobox", { name: "Situação do contrato" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Prazo do retorno" })).toBeTruthy();
  });

  it("estados vazios dizem o que aparece em cada visão, sem fingir que está em dia", () => {
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({ view: "attention" })} counts={counts} origins={[]} clients={{ ...clients, rows: [], totalCount: 0 }} />);
    expect(screen.getByText("Nada pedindo atenção agora")).toBeTruthy();
    expect(screen.queryByText(/em dia/i)).toBeNull();
    cleanup();

    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({ view: "negotiating", query: "zzz" })} counts={counts} origins={[]} leads={{ ...leads, rows: [], totalCount: 0, totalPages: 0 }} />);
    expect(screen.getByText("Nada encontrado")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Limpar busca e filtros" }).getAttribute("href")).toBe("/clientes?view=negotiating&page=1");
  });

  it("Adicionar contato só aparece com a ação e oferece apenas Novo interessado", () => {
    const { unmount } = render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} />);
    expect(screen.queryByRole("button", { name: /Adicionar contato/ })).toBeNull();
    unmount();

    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} addContactAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Adicionar contato/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Novo interessado" })).toBeTruthy();
    expect(screen.queryByText(/Cliente que já possuo/)).toBeNull();
  });
});

describe("Adicionar contato: Novo interessado", () => {
  function fill() {
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Diana Reis" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Telefone" }), { target: { value: "11 98888-1111" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Observação (opcional)" }), { target: { value: "Indicação da Ana" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Consentimento LGPD/ }));
  }

  it("envia só os campos com destino e mostra o sucesso com o caminho para a conversa", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, leadId: "lead-new", noteSaved: true });
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} addContactAction={action} />);
    fill();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cadastrar interessado" })); });

    expect(action).toHaveBeenCalledWith({ nome: "Diana Reis", telefone: "11 98888-1111", email: "", observacao: "Indicação da Ana", consentimentoLgpd: true });
    expect(await screen.findByText("Diana Reis foi cadastrado.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir conversa" }).getAttribute("href")).toBe("/leads/lead-new");
    expect(refresh).toHaveBeenCalled();
  });

  it("duplicidade de outro corretor: aviso genérico e confirmação explícita antes de reenviar", async () => {
    const action = vi.fn()
      .mockResolvedValueOnce({ ok: false, duplicate: { mine: false } })
      .mockResolvedValueOnce({ ok: true, leadId: "lead-2", noteSaved: true });
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} addContactAction={action} />);
    fill();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cadastrar interessado" })); });

    expect(await screen.findByText(/Este telefone já está cadastrado na corretora/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Cadastrar interessado" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Confirmo que é um novo contato" }));
    await act(async () => { fireEvent.click(submit); });
    expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ duplicateConfirmed: true }));
  });

  it("duplicidade do próprio corretor: mostra o contato dele", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, duplicate: { mine: true, leadId: "lead-a", name: "Bruna Lima" } });
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={{ ...leads, rows: [] }} addContactAction={action} />);
    fill();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cadastrar interessado" })); });
    expect(screen.getByRole("link", { name: "Abrir o contato" }).getAttribute("href")).toBe("/leads/lead-a");
  });

  it("erro de validação mantém o que foi digitado", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "Revise os campos destacados.", fieldErrors: { telefone: "Informe um celular com DDD (ex: 11 99999-9999)." } });
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} addContactAction={action} />);
    fill();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cadastrar interessado" })); });
    expect(screen.getByText("Informe um celular com DDD (ex: 11 99999-9999).")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Nome" }) as HTMLInputElement).value).toBe("Diana Reis");
  });
});
