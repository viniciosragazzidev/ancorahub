// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const dispatchSpy = vi.spyOn(window, "dispatchEvent");

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("./director-chrome-context", () => ({
  useDirectorChrome: () => ({
    shellUser: { name: "Renata Alves", email: "renata@ancora.example", role: "Diretor" },
    viewAs: { canViewAs: true, viewingAs: null },
    profile: {
      name: "Renata Alves",
      roleKey: "director",
      permissions: ["acessar_configuracoes", "acessar_configuracoes_pessoais"],
      userProfileEnabled: true,
      isPlatformAdmin: true,
      activeRoleOverride: null,
    },
    setProfile: vi.fn(),
  }),
}));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ open, title, initialDetent, children }: { open: boolean; title: string; initialDetent?: number; children: React.ReactNode }) => open ? <section role="dialog" aria-label={title} data-initial-detent={initialDetent}>{children}</section> : null,
}));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: () => <span>Avatar</span> }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" onClick={onClick}>{children}</button>,
}));
vi.mock("@/components/super-admin-role-switcher", () => ({ SuperAdminRoleSwitcher: () => <span>Trocar cargo</span> }));
vi.mock("@/features/super-admin/components/view-as", () => ({ ViewAsButton: () => <span>Ver como</span> }));
vi.mock("@/shared/auth/client", () => ({ signOut: vi.fn(async () => undefined) }));

import { DirectorMoreSheet } from "./director-more-sheet";

afterEach(() => {
  cleanup();
  dispatchSpy.mockClear();
});

describe("menu Mais do diretor", () => {
  it("mantém os destinos e ações disponíveis no menu móvel", () => {
    render(<DirectorMoreSheet open onOpenChange={() => undefined} />);
    expect(screen.getByRole("dialog", { name: "Mais" })).toHaveAttribute("data-initial-detent", "1");

    for (const label of ["Buscar", "Agente IA", "Reportar problema", "Meu perfil", "Configurações", "Instalar app", "Todas as notificações", "Ver como", "Trocar cargo", "Sair"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "open-command-palette" }));
  });
});
