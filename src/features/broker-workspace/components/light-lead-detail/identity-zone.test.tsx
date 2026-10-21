// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClientInfoCard } from "./identity-zone";
import type { LightLeadDetailData } from "./types";

const lead: LightLeadDetailData = {
  id: "lead-example", nome: "Cliente Exemplo", telefone: "5521999990000",
  email: "cliente@example.test", status: "in_contact", isCurrentBroker: true,
  createdAt: "2026-10-21T12:00:00Z", city: "Cidade Exemplo", livesCount: 3,
  planName: "Plano Exemplo", carrierName: "Operadora Exemplo",
  clientInfo: [{ key: "planType", label: "Tipo de plano", value: "Individual" }, { key: "email", label: "E-mail", value: "cliente@example.test" }],
};

afterEach(cleanup);

describe("broker client data", () => {
  it("shows contact and persisted customer details even with a sparse clientInfo projection", () => {
    render(<ClientInfoCard lead={lead} c={{ isDistributed: false }} />);
    for (const value of ["5521999990000", "Cidade Exemplo", "Plano Exemplo", "Operadora Exemplo"]) {
      expect(screen.getByText(value)).toBeTruthy();
    }
    expect(screen.getByText("Vidas").parentElement).toHaveTextContent("3");
  });

  it.each([
    { status: "distributed", isCurrentBroker: true, isDistributed: true },
    { status: "in_contact", isCurrentBroker: false, isDistributed: false },
  ])("keeps contact hidden without both ownership and acceptance: %j", ({ isDistributed, ...state }) => {
    render(<ClientInfoCard lead={{ ...lead, ...state }} c={{ isDistributed }} />);
    expect(screen.queryByText(lead.telefone!)).toBeNull();
    expect(screen.queryByText(lead.email!)).toBeNull();
  });
});
