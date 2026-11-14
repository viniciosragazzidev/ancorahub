import { describe, expect, it } from "vitest";

import type { ChatBlock } from "./types";
import { clientMessageIdSchema } from "@/features/leads/note-idempotency";

import { appendSending, newClientMessageId, settleSend, startRetry } from "./user-send-core";

const base: ChatBlock[] = [{ type: "assistant", id: "a1", text: "Oi" }];

describe("envio otimista da conversa", () => {
  it("a mensagem entra na hora como enviando e vira enviada quando o servidor confirma", () => {
    const sending = appendSending(base, { type: "user", id: "m1", text: "Liguei para ele" });
    expect(sending.at(-1)).toEqual({ type: "user", id: "m1", text: "Liguei para ele", status: "sending" });
    const sent = settleSend(sending, "m1", true);
    expect(sent.at(-1)).toEqual({ type: "user", id: "m1", text: "Liguei para ele" });
    expect(sent).toHaveLength(2);
  });

  it("em erro fica não enviada sem perder o texto", () => {
    const failed = settleSend(appendSending(base, { type: "user", id: "m1", text: "Liguei" }), "m1", false);
    expect(failed.at(-1)).toEqual({ type: "user", id: "m1", text: "Liguei", status: "failed" });
  });

  it("tentar de novo reenvia a mesma mensagem, sem duplicar", () => {
    const failed = settleSend(appendSending(base, { type: "user", id: "m1", text: "Liguei" }), "m1", false);
    const retry = startRetry(failed, "m1");
    expect(retry?.text).toBe("Liguei");
    expect(retry?.blocks).toHaveLength(2);
    expect(retry?.blocks.at(-1)).toMatchObject({ id: "m1", status: "sending" });
    // Segundo toque enquanto ainda envia: nada acontece.
    expect(startRetry(retry!.blocks, "m1")).toBeNull();
  });

  it("ignora respostas de mensagens que não estão mais enviando", () => {
    const sent = settleSend(appendSending(base, { type: "user", id: "m1", text: "Oi" }), "m1", true);
    expect(settleSend(sent, "m1", false)).toBe(sent);
    expect(settleSend(sent, "outra", true)).toBe(sent);
  });
});

describe("chave de idempotência da mensagem", () => {
  it("cada mensagem ganha um id único que o servidor aceita como chave", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newClientMessageId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(clientMessageIdSchema.safeParse(id).success).toBe(true);
  });

  it("o tentar de novo mantém o mesmo id da mensagem", () => {
    const id = newClientMessageId();
    const failed = settleSend(appendSending(base, { type: "user", id, text: "Liguei" }), id, false);
    expect(startRetry(failed, id)?.blocks.at(-1)).toMatchObject({ id, status: "sending" });
  });
});
