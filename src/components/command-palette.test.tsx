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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("paleta do diretor", () => {
  it("Ctrl+K abre a busca unificada de páginas e leads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ groups: [{ type: "lead", label: "Leads", items: [{ id: "lead-1", title: "Marina Costa", subtitle: "Cliente", href: "/leads/lead-1" }] }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ArcScopeProvider enabled><CommandPalette /></ArcScopeProvider>);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByPlaceholderText("Buscar páginas, leads e clientes..."), { target: { value: "Marina" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Marina Costa/ })).toBeInTheDocument());
    expect(screen.queryByText("Nenhuma funcionalidade encontrada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Marina Costa/ }));
    expect(navigation.push).toHaveBeenCalledWith("/leads/lead-1");
  });

  it("mantem o ramo normal sem a chave", () => {
    render(<ArcScopeProvider enabled={false}><CommandPalette /></ArcScopeProvider>);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "Digite para buscar p\u00e1ginas, fun\u00e7\u00f5es ou comandos (ex: 'resetar mem\u00f3ria', 'comiss\u00f5es', 'leads')...");
    expect(screen.getByTestId("scroll-area")).toHaveClass("max-h-[380px]", "p-2");
    fireEvent.change(input, { target: { value: "lead" } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByRole("textbox")).toHaveValue("lead");
  });
});
