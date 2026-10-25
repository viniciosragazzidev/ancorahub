// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadsHeaderActions } from "./leads-header-actions";

// Chave desligada (sem provider): as ações do topo de /leads seguem com o mesmo HTML de antes do Lite.
// O snapshot foi gerado com o arquivo original.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/leads",
}));
vi.mock("./bulk-lead-import-dialog", () => ({ BulkLeadImportDialog: () => null }));
vi.mock("./manual-lead-sheet", () => ({ ManualLeadSheet: () => null }));

afterEach(cleanup);

describe("ações do topo de /leads com a chave desligada", () => {
  it("preserva o HTML legado", () => {
    const { container } = render(
      <LeadsHeaderActions
        period={30}
        plans={[]}
        branches={[{ id: "b1", name: "Centro" }]}
        queues={[]}
        role="director"
        jobTitle="director"
        branchId={null}
        urgentLead={{ id: "l1", nome: "Maria Nova", status: "new", urgentReason: "SLA estourando" }}
      >
        <a href="/leads/l1">Próximo lead</a>
      </LeadsHeaderActions>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
