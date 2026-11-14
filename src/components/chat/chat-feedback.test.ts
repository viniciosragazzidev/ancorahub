import { describe, expect, it, vi } from "vitest";

import { CHAT_ACTION_FEEDBACK, feedbackOnChoose, feedbackOnResult } from "./chat-feedback";

describe("feedback das ações do chat", () => {
  it("a nota (centenas por dia) fica em silêncio, inclusive no toque", () => {
    const fire = vi.fn();
    feedbackOnChoose("lead.addNote", fire);
    feedbackOnResult("lead.addNote", { ok: true }, fire);
    expect(fire).not.toHaveBeenCalled();
  });

  it("aceite: toque ao escolher e confirmação sem som ao concluir", () => {
    const fire = vi.fn();
    feedbackOnChoose("lead.accept", fire);
    feedbackOnResult("lead.accept", { ok: true }, fire);
    expect(fire.mock.calls).toEqual([["tap"], ["confirm", undefined]]);
  });

  it("pausar o plantão (ocasional) tem som de confirmação", () => {
    const fire = vi.fn();
    feedbackOnResult("duty.pause", { ok: true }, fire);
    expect(fire).toHaveBeenCalledWith("confirm", { sound: true });
  });

  it("cancelar retorno confirma só com o toque curto", () => {
    const fire = vi.fn();
    feedbackOnResult("lead.cancelReturn", { ok: true }, fire);
    expect(fire).toHaveBeenCalledWith("tap", undefined);
  });

  it("falha e ressalva usam erro e alerta, para qualquer ação", () => {
    const fire = vi.fn();
    feedbackOnResult("lead.addNote", "failed", fire);
    feedbackOnResult("lead.changeStep", { ok: false }, fire);
    feedbackOnResult("lead.changeStep", { ok: true, warning: true }, fire);
    expect(fire.mock.calls).toEqual([["error"], ["error"], ["warning"]]);
  });

  it("toda ação do chat tem um nível", () => {
    expect(Object.keys(CHAT_ACTION_FEEDBACK)).toHaveLength(15);
  });
});
