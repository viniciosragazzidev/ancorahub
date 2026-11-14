// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fire = vi.hoisted(() => vi.fn(() => ({ celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));

import { ActionNoticeLine, useActionNotice, useActionStateFeedback } from "./action-notice";

function Harness({ cause, retry }: { cause?: unknown; retry?: () => void }) {
  const notice = useActionNotice();
  return <>
    <button type="button" onClick={() => notice.succeed("Convite enviado.")}>ok</button>
    <button type="button" onClick={() => notice.succeed("Escala publicada.", { milestone: { budgetKey: "escala-mes" } })}>marco</button>
    <button type="button" onClick={() => notice.fail(cause, { keeps: "O convite continua pendente", fallback: "Não consegui agora", retry })}>falha</button>
    <ActionNoticeLine notice={notice.notice} />
  </>;
}

beforeEach(() => fire.mockClear());
afterEach(() => cleanup());

describe("useActionNotice + ActionNoticeLine", () => {
  it("confirma no objeto com check e nível 1, sem som por padrão", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "ok" }));
    expect(screen.getByRole("status").textContent).toBe("Convite enviado.");
    expect(fire).toHaveBeenCalledWith("confirm", { sound: undefined });
  });

  it("marco usa o nível 2 com a chave do limite diário", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "marco" }));
    expect(fire).toHaveBeenCalledWith("milestone", { budgetKey: "escala-mes" });
  });

  it("erro mostra a causa normalizada, o que continua valendo e Tentar de novo", () => {
    const retry = vi.fn();
    render(<Harness cause={{ ok: false, error: "TypeError: Cannot read properties of undefined" }} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "falha" }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Não consegui agora. O convite continua pendente.");
    expect(alert.textContent).not.toContain("TypeError");
    expect(fire).toHaveBeenCalledWith("error");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("sem retry, não oferece o botão", () => {
    render(<Harness cause="Esse corretor não está mais livre na sua unidade." />);
    fireEvent.click(screen.getByRole("button", { name: "falha" }));
    expect(screen.getByRole("alert").textContent).toContain("Esse corretor não está mais livre na sua unidade.");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });
});

describe("useActionStateFeedback", () => {
  it("dispara uma vez por resultado novo e ignora o estado inicial e a pergunta de modo", () => {
    const initial = {};
    const { rerender } = renderHook(({ state }) => useActionStateFeedback(state), { initialProps: { state: initial as { success?: boolean; error?: string; needsAssignmentMode?: boolean } } });
    expect(fire).not.toHaveBeenCalled();
    act(() => rerender({ state: { success: true } }));
    expect(fire).toHaveBeenLastCalledWith("confirm", { sound: undefined });
    act(() => rerender({ state: { error: "Escolha se deseja atribuir direto.", needsAssignmentMode: true } }));
    expect(fire).toHaveBeenCalledTimes(1);
    act(() => rerender({ state: { error: "Sem permissão." } }));
    expect(fire).toHaveBeenLastCalledWith("error");
    expect(fire).toHaveBeenCalledTimes(2);
  });
});
