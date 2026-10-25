// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: { role: "director", tenantId: "tenant-1", userId: "user-1", branchId: null as string | null, jobTitle: "director" },
  lite: true,
}));

// Banco: todas as consultas de operadoras e planos devolvem listas vazias.
function chain(rows: unknown[]) {
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit"]) query[method] = () => query;
  query.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return query;
}
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ select: () => chain([]) }) }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/director-lite/style-flag", () => ({ isDirectorLitePageOnServer: async () => state.lite }));
vi.mock("@/features/documents/actions", () => ({
  getDocumentRequirements: async () => [],
  getPendingDocuments: async () => [],
  createRequirementAction: vi.fn(),
  deleteRequirementAction: vi.fn(),
  reviewDocumentAction: vi.fn(),
  bulkReviewDocumentsAction: vi.fn(),
}));
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import DocumentsPage from "./page";

afterEach(cleanup);

async function renderPage(context: Partial<typeof state.context>) {
  state.context = { ...state.context, ...context };
  render((await DocumentsPage()) as ReactElement);
}

describe("documentos no Lite por papel (chave ligada)", () => {
  it("diretor: fila e configuração de requisitos", async () => {
    await renderPage({ role: "director", jobTitle: "director" });
    expect(screen.getByRole("tab", { name: "Configuração de requisitos" })).toBeInTheDocument();
  });

  for (const papel of [
    { nome: "gestor", context: { role: "manager", jobTitle: "manager", branchId: "branch-1" } },
    { nome: "marketing", context: { role: "manager", jobTitle: "marketing", branchId: null } },
  ]) {
    it(`${papel.nome}: só a fila, sem a configuração de requisitos (como no legado)`, async () => {
      await renderPage(papel.context);
      expect(screen.queryByRole("tab", { name: "Configuração de requisitos" })).not.toBeInTheDocument();
      expect(screen.queryByText("Configuração de requisitos")).not.toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Status dos documentos" })).toBeInTheDocument();
    });
  }
});
