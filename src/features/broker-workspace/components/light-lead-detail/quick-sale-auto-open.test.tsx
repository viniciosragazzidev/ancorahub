// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/sonner", () => ({ toast: { info: toastInfo } }));

import { useQuickSaleAutoOpen } from "./quick-sale-auto-open";

type HookArgs = Parameters<typeof useQuickSaleAutoOpen>[0];

function Probe(props: HookArgs) {
  useQuickSaleAutoOpen(props);
  return null;
}

function controller(overrides: Partial<HookArgs["c"]> = {}): HookArgs["c"] {
  return {
    isDistributed: false,
    leadStatus: "negotiation",
    approvedDocument: undefined,
    rejectedDocument: undefined,
    setShowSaleConfirm: vi.fn(),
    handleRequestSale: vi.fn(),
    ...overrides,
  };
}

const lead = { isCurrentBroker: true, hasActiveSale: false, aiSalePrompt: null };

beforeEach(() => {
  window.history.replaceState(null, "", "/leads/lead-1?registrar-venda=1&ficha=1#topo");
  toastInfo.mockReset();
});
afterEach(cleanup);

describe("abertura automática pelo atalho registrar-venda", () => {
  it("abre o registro uma vez e limpa o parâmetro sem nova entrada no histórico", () => {
    const c = controller();
    const historyLength = window.history.length;
    const { rerender } = render(<Probe enabled lead={lead} c={c} registrationV2Enabled />);
    rerender(<Probe enabled lead={lead} c={c} registrationV2Enabled />);
    expect(c.setShowSaleConfirm).toHaveBeenCalledTimes(1);
    expect(c.setShowSaleConfirm).toHaveBeenCalledWith(true);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/leads/lead-1?ficha=1#topo");
    expect(window.history.length).toBe(historyLength);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("no fluxo anterior abre o mesmo Registrar venda do botão", () => {
    const c = controller();
    render(<Probe enabled lead={lead} c={c} registrationV2Enabled={false} />);
    expect(c.handleRequestSale).toHaveBeenCalledTimes(1);
    expect(c.setShowSaleConfirm).not.toHaveBeenCalled();
  });

  it("quando não pode registrar, só mostra o motivo", () => {
    const c = controller({ isDistributed: true, leadStatus: "distributed" });
    render(<Probe enabled lead={lead} c={c} registrationV2Enabled />);
    expect(c.setShowSaleConfirm).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith("Aceite o lead antes de registrar a venda.");
    expect(window.location.search).toBe("?ficha=1");
  });

  it("chave desligada ou sem o atalho: não faz nada", () => {
    const c = controller();
    render(<Probe enabled={false} lead={lead} c={c} registrationV2Enabled />);
    expect(c.setShowSaleConfirm).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?registrar-venda=1&ficha=1");
  });
});
