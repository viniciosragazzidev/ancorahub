import type { ChatBlock } from "./types";

type UserBlock = Extract<ChatBlock, { type: "user" }>;

/**
 * Mensagem do corretor na conversa do Lite: aparece na hora como "enviando", vira enviada
 * quando o servidor confirma e, em erro, fica "Não enviada" com o texto guardado para tentar de novo.
 */
export function appendSending(blocks: ChatBlock[], block: Omit<UserBlock, "status">): ChatBlock[] {
  return [...blocks, { ...block, status: "sending" }];
}

/** Servidor respondeu: some o "enviando" (ok) ou a mensagem fica marcada como não enviada. */
export function settleSend(blocks: ChatBlock[], id: string, ok: boolean): ChatBlock[] {
  let changed = false;
  const next = blocks.map((block) => {
    if (block.type !== "user" || block.id !== id || block.status !== "sending") return block;
    changed = true;
    if (ok) {
      const sent: UserBlock = { ...block };
      delete sent.status;
      return sent;
    }
    return { ...block, status: "failed" as const };
  });
  return changed ? next : blocks;
}

/**
 * "Tentar de novo": só uma mensagem não enviada volta a "enviando" (nunca duplica uma que já
 * está indo). Devolve o texto a reenviar, ou null quando não há o que tentar.
 */
export function startRetry(blocks: ChatBlock[], id: string): { blocks: ChatBlock[]; text: string } | null {
  const target = blocks.find((block): block is UserBlock => block.type === "user" && block.id === id);
  if (!target || target.status !== "failed") return null;
  return {
    text: target.text,
    blocks: blocks.map((block) => (block === target ? { ...target, status: "sending" as const } : block)),
  };
}
