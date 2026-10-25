// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";

import { LeadsHeaderActions } from "./leads-header-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/leads",
}));
vi.mock("./bulk-lead-import-dialog", () => ({ BulkLeadImportDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Importar leads" /> : null) }));
vi.mock("./manual-lead-sheet", () => ({ ManualLeadSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Novo lead" /> : null) }));

afterEach(cleanup);

function renderLite(role: "director" | "broker" = "director") {
  render(
    <ArcScopeProvider enabled>
      <LeadsHeaderActions
        period={30}
        plans={[]}
        branches={[]}
        queues={[]}
        role={role}
        jobTitle={role}
        branchId={null}
        urgentLead={{ id: "l1", nome: "Maria Nova", status: "new", urgentReason: "SLA estourando" }}
      >
        <span>legado</span>
      </LeadsHeaderActions>
    </ArcScopeProvider>,
  );
}

describe("ações do topo de /leads com a chave do diretor", () => {
  it("só Novo lead como principal, Próximo lead neutro e o resto no menu; sem período no topo", () => {
    renderLite();
    expect(screen.queryByText("legado")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Período" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próximo lead" })).toHaveAttribute("href", "/leads/l1");
    expect(screen.getByRole("link", { name: "Próximo lead" })).toHaveAttribute("title", "Maria Nova: SLA estourando");
    fireEvent.click(screen.getByRole("button", { name: "Novo lead" }));
    expect(screen.getByRole("dialog", { name: "Novo lead" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Mais ações" })[0]!);
    expect(screen.getByRole("menuitem", { name: "Leads arquivados" })).toHaveAttribute("href", "/leads/arquivados");
    fireEvent.click(screen.getByRole("menuitem", { name: "Importar leads" }));
    expect(screen.getByRole("dialog", { name: "Importar leads" })).toBeInTheDocument();
  });

  it("o menu compacto (abaixo de 1024px) também leva o Próximo lead", () => {
    renderLite();
    fireEvent.click(screen.getAllByRole("button", { name: "Mais ações" })[1]!);
    expect(screen.getByRole("menuitem", { name: "Próximo lead" })).toHaveAttribute("href", "/leads/l1");
  });
});
