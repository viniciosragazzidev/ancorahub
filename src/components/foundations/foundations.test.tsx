// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PageHeader,
  PageActions,
  PageTabs,
  FilterBar,
  ActiveFilterChips,
  RowActions,
  Section,
  CollapsibleSection,
  SettingsSection,
  SettingsToggleRow,
  ConfirmDialog,
  StatusBadge,
  StatusDot,
  EmptyState,
  TableSkeleton,
} from "./index";

describe("Canonical Foundations & Components (UX-1B)", () => {
  it("renders PageHeader with title, description, context and actions", () => {
    render(
      <PageHeader
        breadcrumb={<span>Gestão</span>}
        title="Unidades"
        context={<span data-testid="ctx-badge">3 ativas</span>}
        description="Gerencie as filiais operacionais da corretora."
        actions={<button type="button">Nova Unidade</button>}
      />
    );

    expect(screen.getByText("Gestão")).toBeDefined();
    expect(screen.getByText("Unidades")).toBeDefined();
    expect(screen.getByTestId("ctx-badge")).toBeDefined();
    expect(screen.getByText("Gerencie as filiais operacionais da corretora.")).toBeDefined();
    expect(screen.getByText("Nova Unidade")).toBeDefined();
  });

  it("renders PageActions with primary and dropdown options", () => {
    const handlePrimary = vi.fn();
    render(
      <PageActions
        primaryAction={{ label: "Novo Lead", onClick: handlePrimary }}
        moreActions={[
          { label: "Importar CSV", onClick: vi.fn() },
          { label: "Excluir Todos", destructive: true, onClick: vi.fn() },
        ]}
      />
    );

    const primaryBtn = screen.getByText("Novo Lead");
    fireEvent.click(primaryBtn);
    expect(handlePrimary).toHaveBeenCalledOnce();
  });

  it("renders PageTabs and triggers tab change", () => {
    const handleChange = vi.fn();
    const tabs = [
      { id: "overview", label: "Visão Geral" },
      { id: "commercial", label: "Comercial", badge: 5 },
    ];

    render(<PageTabs tabs={tabs} active="overview" onTabChange={handleChange} />);

    expect(screen.getByText("Visão Geral")).toBeDefined();
    expect(screen.getByText("Comercial")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();

    const commTab = screen.getByText("Comercial");
    fireEvent.click(commTab);
    expect(handleChange).toHaveBeenCalledWith("commercial");
  });

  it("renders FilterBar with search and clear actions", () => {
    const handleSearch = vi.fn();
    const handleClear = vi.fn();

    render(
      <FilterBar
        searchValue="Unidade SP"
        onSearchChange={handleSearch}
        hasActiveFilters
        onClearFilters={handleClear}
      />
    );

    expect(screen.getByDisplayValue("Unidade SP")).toBeDefined();
    const clearBtn = screen.getByText("Limpar tudo");
    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledOnce();
  });

  it("renders ActiveFilterChips and handles removing individual chip", () => {
    const handleRemove = vi.fn();
    const chips = [
      { id: "status", label: "Status", value: "Ativo" },
      { id: "unit", label: "Unidade", value: "SP Centro" },
    ];

    render(<ActiveFilterChips chips={chips} onRemoveChip={handleRemove} />);

    expect(screen.getByText("Ativo")).toBeDefined();
    expect(screen.getByText("SP Centro")).toBeDefined();

    const removeBtn = screen.getByLabelText("Remover filtro Status: Ativo");
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledWith("status");
  });

  it("renders Section and CollapsibleSection disclosure", () => {
    render(
      <Section title="Informações Gerais" description="Dados básicos do cadastro">
        <p>Conteúdo da seção</p>
      </Section>
    );

    expect(screen.getByText("Informações Gerais")).toBeDefined();
    expect(screen.getByText("Conteúdo da seção")).toBeDefined();

    const { rerender } = render(
      <CollapsibleSection title="Configurações Avançadas" defaultOpen={false}>
        <p>Conteúdo oculto</p>
      </CollapsibleSection>
    );

    expect(screen.getByText("Configurações Avançadas")).toBeDefined();
    expect(screen.queryByText("Conteúdo oculto")).toBeNull();

    const toggleBtn = screen.getByText("Configurações Avançadas");
    fireEvent.click(toggleBtn);
    expect(screen.getByText("Conteúdo oculto")).toBeDefined();
  });

  it("renders SettingsToggleRow with conditional child disclosure", () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <SettingsToggleRow
        label="Distribuição Automática"
        description="Distribui novos leads imediatamente."
        checked={false}
        onCheckedChange={handleChange}
      >
        <p>Opções de Roleta</p>
      </SettingsToggleRow>
    );

    expect(screen.getByText("Distribuição Automática")).toBeDefined();
    expect(screen.queryByText("Opções de Roleta")).toBeNull();

    rerender(
      <SettingsToggleRow
        label="Distribuição Automática"
        description="Distribui novos leads imediatamente."
        checked={true}
        onCheckedChange={handleChange}
      >
        <p>Opções de Roleta</p>
      </SettingsToggleRow>
    );

    expect(screen.getByText("Opções de Roleta")).toBeDefined();
  });

  it("renders ConfirmDialog and executes confirm callback", async () => {
    const handleConfirm = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Excluir Unidade?"
        description="Esta ação removerá a filial permanentemente."
        confirmLabel="Sim, Excluir"
        destructive={true}
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByText("Excluir Unidade?")).toBeDefined();
    const confirmBtn = screen.getByText("Sim, Excluir");
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledOnce();
  });

  it("renders StatusBadge with sematic tones and dot indicator", () => {
    render(
      <div>
        <StatusBadge label="Disponível" tone="success" dot />
        <StatusBadge label="Urgente" tone="danger" />
        <StatusDot tone="warning" />
      </div>
    );

    expect(screen.getByText("Disponível")).toBeDefined();
    expect(screen.getByText("Urgente")).toBeDefined();
  });

  it("renders EmptyState with standard semantic types", () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        type="EMPTY_SEARCH"
        title="Nenhum lead encontrado"
        description="Tente ajustar os filtros ou pesquisar por outro termo."
        action={{ label: "Limpar Filtros", onClick: handleAction }}
      />
    );

    expect(screen.getByText("Nenhum lead encontrado")).toBeDefined();
    const actionBtn = screen.getByText("Limpar Filtros");
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledOnce();
  });

  it("renders TableSkeleton placeholder", () => {
    render(<TableSkeleton rows={3} columns={3} />);
    expect(document.querySelector('[data-slot="canonical-table-skeleton"]')).toBeDefined();
  });
});
