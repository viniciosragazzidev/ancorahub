// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../quick-sale-actions", () => ({ listQuickSaleLeadsAction: vi.fn(async () => ({ ok: true, leads: [] })) }));
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

import { normalizeBrokerWalletFilters } from "@/features/customers/broker-wallet-filters";
import type { BrokerWalletLeadsResult } from "@/features/customers/broker-wallet-leads";

import { BrokerClientWalletList } from "./broker-client-wallet";
import { BrokerMyWallet } from "./broker-my-wallet";
import { PriorClientProfile } from "./prior-client-profile";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const counts = { negotiating: 1, all: 2, attention: 1, archived: 0 };
const leads: BrokerWalletLeadsResult = { view: "negotiating", rows: [], page: 1, pageSize: 20, totalPages: 0, totalCount: 0, counts: { negotiating: 1, archived: 0 }, origins: [] };

describe("Cliente que já possuo na tela", () => {
  it("sem a ação da 4b, o painel só tem Novo interessado", () => {
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} addContactAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cliente que já possuo" })).toBeNull();
  });

  it("com a ação, troca para Cliente que já possuo e envia contratos opcionais", async () => {
    const prior = vi.fn().mockResolvedValue({ ok: true, clientId: "client-new" });
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} addContactAction={vi.fn()} addPriorClientAction={prior} />);
    fireEvent.click(screen.getByRole("button", { name: "Cliente que já possuo" }));
    const nameFields = screen.getAllByRole("textbox", { name: "Nome" });
    fireEvent.change(nameFields[0], { target: { value: "Ana Prévia" } });
    fireEvent.change(screen.getAllByRole("textbox", { name: "Telefone" })[0], { target: { value: "11 98888-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar contrato (opcional)" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Operadora" }), { target: { value: "Operadora X" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cadastrar cliente" })); });
    expect(prior).toHaveBeenCalledWith({
      nome: "Ana Prévia", telefone: "11 98888-7777", email: "", observacao: "",
      contracts: [{ productType: "unknown", carrierName: "Operadora X", coverageStartDate: "", renewalDate: "", status: "unknown" }],
    });
    expect(await screen.findByText("Ana Prévia está na sua carteira.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir perfil" }).getAttribute("href")).toBe("/clientes/client-new");
  });

  it("duplicidade fora do escopo não mostra nome nem responsável", async () => {
    const prior = vi.fn().mockResolvedValue({ ok: false, duplicate: { mine: false } });
    render(<BrokerMyWallet filters={normalizeBrokerWalletFilters({})} counts={counts} origins={[]} leads={leads} addContactAction={vi.fn()} addPriorClientAction={prior} />);
    fireEvent.click(screen.getByRole("button", { name: "Cliente que já possuo" }));
    fireEvent.change(screen.getAllByRole("textbox", { name: "Nome" })[0], { target: { value: "Ana" } });
    fireEvent.change(screen.getAllByRole("textbox", { name: "Telefone" })[0], { target: { value: "11 98888-0000" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cadastrar cliente" })); });
    expect(screen.getByText(/Este telefone já está cadastrado na corretora/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Cadastrar cliente" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a visão Clientes marca a carteira anterior e abre o perfil", () => {
    render(<BrokerClientWalletList totalCount={1} rows={[{
      id: "client-p", leadId: null, priorPortfolio: true, name: "Bruno Prévia", phone: "5511977776666", email: null,
      convertedAt: new Date("2026-11-10T12:00:00.000Z"), origin: null, contractStatus: "active", renewalWindowStartDate: null, nextTask: null, attentionReason: "renewal",
    }]} />);
    expect(screen.getByText("Carteira anterior")).toBeTruthy();
    expect(screen.getByText("Renovação de contrato anterior em até 30 dias")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Bruno Prévia/ }).find((link) => !link.getAttribute("aria-label"))!.getAttribute("href")).toBe("/clientes/client-p");
  });

  it("o perfil mostra o selo, as pendências e a renovação próxima", () => {
    render(<PriorClientProfile
      client={{ id: "client-p", name: "Bruno Prévia", phone: "5511977776666", email: null, originNote: null }}
      todayKey="2026-11-13"
      contracts={[
        { id: "c1", productType: "PF", carrierName: "Operadora X", coverageStartDate: "2025-12-01", renewalDate: "2026-12-01", status: "active" },
        { id: "c2", productType: "unknown", carrierName: null, coverageStartDate: null, renewalDate: null, status: "unknown" },
      ]}
      actions={{ update: vi.fn(), saveContract: vi.fn(), removeContract: vi.fn() }}
    />);
    expect(screen.getAllByText("Carteira anterior").length).toBeGreaterThan(0);
    expect(screen.getByText("Renovação próxima")).toBeTruthy();
    expect(screen.getByText("Pendente: produto, operadora, início da vigência, renovação, situação")).toBeTruthy();
    expect(screen.getByText(/não gera venda, comissão nem pontos/)).toBeTruthy();
  });

  it("remover contrato pede confirmação antes de chamar a ação", async () => {
    const removeContract = vi.fn().mockResolvedValue({ ok: true });
    render(<PriorClientProfile
      client={{ id: "client-p", name: "Bruno Prévia", phone: "5511977776666", email: null, originNote: null }}
      todayKey="2026-11-13"
      contracts={[{ id: "c1", productType: "PF", carrierName: "Operadora X", coverageStartDate: null, renewalDate: null, status: "active" }]}
      actions={{ update: vi.fn(), saveContract: vi.fn(), removeContract }}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(removeContract).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirmar remoção" })); });
    expect(removeContract).toHaveBeenCalledWith({ clientId: "client-p", contractId: "c1" });
  });

  it("salvar os dados confirma no próprio cartão com o check, só depois do sucesso", async () => {
    const update = vi.fn().mockResolvedValue({ ok: true });
    render(<PriorClientProfile
      client={{ id: "client-p", name: "Bruno Prévia", phone: "5511977776666", email: null, originNote: null }}
      todayKey="2026-11-13"
      contracts={[]}
      actions={{ update, saveContract: vi.fn(), removeContract: vi.fn() }}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Editar dados" }));
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar" })); });
    expect(update).toHaveBeenCalled();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Dados salvos");
    expect(status.closest("section")).toHaveAttribute("aria-label", "Dados do cliente");
  });

  it("erro ao salvar não mostra confirmação, só o erro", async () => {
    const update = vi.fn().mockResolvedValue({ ok: false, error: "Nome obrigatório." });
    render(<PriorClientProfile
      client={{ id: "client-p", name: "Bruno Prévia", phone: "5511977776666", email: null, originNote: null }}
      todayKey="2026-11-13"
      contracts={[]}
      actions={{ update, saveContract: vi.fn(), removeContract: vi.fn() }}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Editar dados" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar" })); });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("alert").some((node) => node.textContent === "Nome obrigatório.")).toBe(true);
  });
});
