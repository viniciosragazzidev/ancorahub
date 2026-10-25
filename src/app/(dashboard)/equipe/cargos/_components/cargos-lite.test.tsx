// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const actions = vi.hoisted(() => ({ saveCustomRoleAction: vi.fn(async () => undefined), archiveCustomRoleAction: vi.fn(async () => undefined) }));
vi.mock("../actions", () => actions);

import { CargosLite, type CargoCapability, type CargoRole } from "./cargos-lite";

afterEach(cleanup);

// O Switch Arc (Radix) mede o próprio tamanho.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const catalog: CargoCapability[] = [
  { key: "leads.ver", label: "Ver leads", description: "Lista e ficha dos leads.", category: "LEADS", delegable: true, scopes: ["tenant", "branch"] },
  { key: "relatorios.exportar", label: "Exportar relatórios", description: "Baixar planilhas.", category: "RELATÓRIOS", delegable: true, scopes: ["tenant"] },
];
const routeCatalog = [{ key: "vendas", label: "Vendas", description: "Fechamentos.", category: "Comercial", path: "/vendas" }] as never;
const roles: CargoRole[] = [
  { id: "r1", name: "Marketing digital", description: "Campanhas e origens.", color: "primary", icon: "shield", scope: "tenant", status: "active", version: 3, updatedAt: "2026-10-20T12:00:00.000Z", memberCount: 2, permissions: ["leads.ver"] },
  { id: "r2", name: "Financeiro", description: null, color: "primary", icon: "shield", scope: "branch", status: "draft", version: 1, updatedAt: "2026-10-21T12:00:00.000Z", memberCount: 0, permissions: [] },
];

describe("CargosLite", () => {
  it("filtra por estado e busca", () => {
    render(<CargosLite enabled catalog={catalog} routeCatalog={routeCatalog} roles={roles} />);
    fireEvent.click(screen.getByRole("button", { name: /^Rascunhos/ }));
    expect(screen.getByRole("button", { name: "Editar cargo Financeiro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cargo Marketing digital" })).not.toBeInTheDocument();
  });

  it("edita: troca a abrangência, limpa permissões fora dela e salva pela mesma ação", async () => {
    render(<CargosLite enabled catalog={catalog} routeCatalog={routeCatalog} roles={roles} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar cargo Marketing digital" }));
    fireEvent.click(screen.getByRole("tab", { name: /Permissões/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Exportar relatórios" }));
    fireEvent.click(screen.getByRole("tab", { name: "Identidade" }));
    fireEvent.click(screen.getByRole("button", { name: /^Abrangência/ }));
    fireEvent.click(screen.getByRole("option", { name: /^Uma unidade/ }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" })); });
    expect(actions.saveCustomRoleAction).toHaveBeenCalledWith(expect.objectContaining({ id: "r1", scope: "branch", permissions: ["leads.ver"] }));
  });

  it("módulo desligado: aviso e criar desativado", () => {
    render(<CargosLite enabled={false} catalog={catalog} routeCatalog={routeCatalog} roles={roles} />);
    expect(screen.getByRole("note")).toHaveTextContent("Módulo desabilitado");
    expect(screen.getByRole("button", { name: /Novo cargo/ })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^Editar cargo/ })).toHaveLength(2);
  });
});
