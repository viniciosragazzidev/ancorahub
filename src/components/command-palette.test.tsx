// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigation.push }) }));
vi.mock("@/shared/auth/actions", () => ({ getUserDisplayInfo: vi.fn(async () => ({ permissions: ["acessar_dashboard"] })) }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => open ? <div><button type="button" onClick={() => onOpenChange(false)}>Fechar</button>{children}</div> : null,
  DialogPopup: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="scroll-area" className={className}>{children}</div> }));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { CommandPalette } from "./command-palette";
import { getUserDisplayInfo } from "@/shared/auth/actions";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("paleta do diretor", () => {
  it("mostra carregamento durante a espera do debounce", () => {
    render(<ArcScopeProvider enabled><CommandPalette /></ArcScopeProvider>);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByPlaceholderText("Buscar páginas, leads, clientes e pessoas..."), { target: { value: "Marina" } });

    expect(screen.getByRole("status")).toHaveTextContent("Buscando no CRM");
    expect(screen.queryByText(/Nada encontrado/)).not.toBeInTheDocument();
  });

  it("Ctrl+K abre a busca unificada de páginas e leads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ groups: [{ type: "lead", label: "Leads", items: [{ id: "lead-1", title: "Marina Costa", subtitle: "Cliente", href: "/leads/lead-1" }] }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ArcScopeProvider enabled><CommandPalette /></ArcScopeProvider>);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByPlaceholderText("Buscar páginas, leads, clientes e pessoas..."), { target: { value: "Marina" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /Marina Costa/ })).toBeInTheDocument());
    expect(screen.queryByText("Nenhuma funcionalidade encontrada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Marina Costa/ }));
    expect(navigation.push).toHaveBeenCalledWith("/leads/lead-1");
  });

  it("fora do Lite usa o mesmo cadastro: sem busca lista o menu por área e limpa ao fechar", async () => {
    vi.mocked(getUserDisplayInfo).mockResolvedValueOnce({ roleKey: "director", jobTitle: null, permissions: ["acessar_vendas", "ver_comissionamento"] } as never);
    render(<ArcScopeProvider enabled={false}><CommandPalette /></ArcScopeProvider>);

    await waitFor(() => expect(getUserDisplayInfo).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(screen.getByText("Comercial")).toBeInTheDocument());
    expect(screen.getByRole("option", { name: /Vendas/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lead" } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("setas escolhem o resultado e Enter abre", async () => {
    navigation.push.mockClear();
    vi.mocked(getUserDisplayInfo).mockResolvedValueOnce({ roleKey: "director", jobTitle: null, permissions: ["acessar_vendas", "ver_comissionamento"] } as never);
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<ArcScopeProvider enabled><CommandPalette /></ArcScopeProvider>);

    await waitFor(() => expect(getUserDisplayInfo).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "vendas" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(1));
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    const target = screen.getAllByRole("option")[1].textContent ?? "";
    fireEvent.keyDown(input, { key: "Enter" });
    expect(navigation.push).toHaveBeenCalledTimes(1);
    expect(target.length).toBeGreaterThan(0);
  });

  it("mostra as páginas do menu na hora, sem acento, antes dos resultados do servidor", async () => {
    vi.mocked(getUserDisplayInfo).mockResolvedValueOnce({ roleKey: "director", jobTitle: null, permissions: ["acessar_vendas", "ver_comissionamento"] } as never);
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<ArcScopeProvider enabled><CommandPalette /></ArcScopeProvider>);

    await waitFor(() => expect(getUserDisplayInfo).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByPlaceholderText("Buscar páginas, leads, clientes e pessoas..."), { target: { value: "comissoes" } });

    await waitFor(() => expect(screen.getByRole("option", { name: /Comercial: Comissões/ })).toBeInTheDocument());
    expect(screen.getByText("Páginas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Comercial: Comissões/ }));
    expect(navigation.push).toHaveBeenCalledWith("/settings?tab=comissoes");
  });
});
