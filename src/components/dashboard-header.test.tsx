// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button> }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <span data-testid="theme-toggle" /> }));
vi.mock("@/components/global-search", () => ({ GlobalSearch: () => <span data-testid="global-search" /> }));
vi.mock("@/components/notification-popover", () => ({ NotificationPopover: () => <button aria-label="Notificações" /> }));
vi.mock("@/components/motion/animated-page-title", () => ({ AnimatedPageTitle: ({ breadcrumb, title }: { breadcrumb: string; title: string }) => <div><span>{breadcrumb}</span><h1>{title}</h1></div> }));
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>Menu</button> }));
vi.mock("@/components/experience-mode-toggle", () => ({ ExperienceModeToggle: () => null }));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span aria-label={name}>Avatar</span> }));
vi.mock("@/components/light/use-director-route", () => ({ useDirectorRoute: () => ({ title: "Lead", parentHref: "/leads" }) }));
vi.mock("@/components/light/director-more-sheet", () => ({ DirectorMoreSheet: ({ open }: { open: boolean }) => open ? <div role="dialog">Mais opções</div> : null }));
vi.mock("@/components/light/light-app-header", () => ({
  LightAppHeader: ({ routeOverride, leading, actions, onOpenMore }: { routeOverride: { title: string }; leading?: React.ReactNode; actions?: React.ReactNode; onOpenMore: () => void }) => <header data-testid="lite-header">{leading}<h1>{routeOverride.title}</h1>{actions}<button aria-label="Abrir menu Mais" onClick={onOpenMore}>Mais</button></header>,
}));

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { DashboardHeader } from "./dashboard-header";

afterEach(() => cleanup());

describe("DashboardHeader", () => {
  it("mantém a estrutura legada quando o skin está desligado", () => {
    const { container } = render(<ArcScopeProvider enabled={false}><DashboardHeader breadcrumb="Painel" title="Visão da operação" /></ArcScopeProvider>);
    const header = container.querySelector('[data-slot="dashboard-header"]');
    expect(header).toHaveClass("sticky", "top-0", "bg-background/92");
    expect(screen.getByTestId("global-search")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(container.querySelector('[data-skin="diretor"]')).toBeNull();
  });

  it("usa o topo Arc e o botão de voltar/mais quando o skin está ligado", () => {
    render(<ArcScopeProvider enabled><DashboardHeader breadcrumb="Equipe" title="Perfil do corretor" /></ArcScopeProvider>);
    expect(screen.getByTestId("lite-header")).toHaveTextContent("Perfil do corretor");
    expect(screen.queryByTestId("global-search")).not.toBeInTheDocument();
    expect(screen.queryByTestId("theme-toggle")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir perfil e mais opções" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu Mais" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Mais opções");
  });
});
