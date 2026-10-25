// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const lite = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/arc/use-director-lite-page", () => ({ useDirectorLitePage: () => lite.on }));
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("../whatsapp-actions", () => ({ diagnoseWahaConnection: vi.fn(async () => ({ ok: true, step: "health" })) }));

import WahaDiagnosticPage from "./page";

afterEach(() => {
  cleanup();
  lite.on = false;
});

describe("/settings/waha-diagnostic", () => {
  it("com a chave desligada, o HTML é o de hoje", () => {
    const { container } = render(<WahaDiagnosticPage />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe("/settings/waha-diagnostic Lite", () => {
  it("com a chave, roda o mesmo diagnóstico e mostra o resultado em texto", async () => {
    lite.on = true;
    const { act, fireEvent } = await import("@testing-library/react");
    render(<WahaDiagnosticPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Executar diagnóstico" }));
    });
    expect(screen.getByText("Conectividade ok")).toBeInTheDocument();
    expect(screen.getByText("health")).toBeInTheDocument();
  });
});
