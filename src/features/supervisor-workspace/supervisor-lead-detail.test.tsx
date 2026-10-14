// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/manager-workspace/manager-lead-transfer-form", () => ({ ManagerLeadTransferForm: () => <div>Formulário de repasse</div> }));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span role="img" aria-label={name} /> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <p>{title}</p> }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button> }));

import { SupervisorLeadDetail } from "./supervisor-lead-detail";

const lead = { id: "lead-1", name: "Marina Alves", status: "in_contact", ownerId: "b1", ownerName: "Paulo Dias", ownerImage: null, productName: "Plano", assignedAt: null, branchName: "Central" };

afterEach(() => cleanup());

describe("SupervisorLeadDetail (gestor Lite tasks and documents)", () => {
  it("shows the lead's tasks and documents when the gestor data is passed", () => {
    render(
      <SupervisorLeadDetail
        lead={lead}
        timeline={[]}
        now="2026-10-14T15:00:00.000Z"
        managerBrokers={[{ id: "b2", name: "Ana Souza" }]}
        tasks={[
          { id: "k1", title: "Ligar para confirmar", dueAt: null, completedAt: null, priority: "normal" },
          { id: "k2", title: "Enviar proposta", dueAt: null, completedAt: new Date("2026-10-13T12:00:00Z"), priority: "normal" },
        ]}
        documents={[{ id: "d1", filename: "rg.pdf", status: "approved", requirementName: "RG" }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Tarefas (2)" })).toBeTruthy();
    expect(screen.getByText("Ligar para confirmar")).toBeTruthy();
    expect(screen.getByText("Concluída")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Documentos (1)" })).toBeTruthy();
    expect(screen.getByText("RG · Aprovado")).toBeTruthy();
  });

  it("keeps the supervisor view unchanged: no tasks or documents sections without the data", () => {
    render(<SupervisorLeadDetail lead={lead} timeline={[]} now="2026-10-14T15:00:00.000Z" />);

    expect(screen.queryByRole("heading", { name: /Tarefas/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Documentos/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Linha do tempo" })).toBeTruthy();
  });
});
