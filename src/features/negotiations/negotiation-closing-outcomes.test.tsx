// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { NegotiationClosingOutcomes } from "./negotiation-closing-outcomes";

afterEach(cleanup);

describe("desfechos do fechamento na tela da direção", () => {
  it("mostra os números do período e a tabela por corretor", () => {
    render(<NegotiationClosingOutcomes summary={{
      periodDays: 30, entered: 4, converted: 2, lost: 1, returned: 1, pendingNow: 58, inClosingNow: 90,
      brokers: [{ brokerId: "t", brokerName: "Tainá Pinto", inClosing: 58, pending: 50, converted: 1, lost: 0, returned: 0 }],
    }} />);
    expect(screen.getByRole("heading", { name: "Desfechos do fechamento" })).toBeTruthy();
    expect(screen.getByText("Últimos 30 dias · 90 em fechamento agora")).toBeTruthy();
    expect(screen.getByText("Desfecho pendente agora").parentElement).toHaveTextContent("58");
    expect(screen.getAllByText("Tainá Pinto").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(String.fromCharCode(0x2014));
  });
});
