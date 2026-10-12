"use client";

import type { Mention } from "./composer";
import type { ChatBlock } from "./types";

/** "@" shortcuts and leads bring blocks into the conversation; the other mentions open another conversation. */
export function isDataMention(handle: string) {
  return handle.startsWith("block:") || handle.startsWith("lead:");
}

let menuCache: { at: number; menu: Mention[] } | null = null;

/** The @ menu with live counts (cached for 30s; GET so it works in "Ver como"). */
export async function fetchMentionMenu(): Promise<Mention[]> {
  if (menuCache && Date.now() - menuCache.at < 30_000) return menuCache.menu;
  try {
    const response = await fetch("/api/chat/mention?menu=1", { cache: "no-store" });
    if (!response.ok) return [];
    const body = (await response.json()) as { menu?: Mention[] };
    menuCache = { at: Date.now(), menu: body.menu ?? [] };
    return menuCache.menu;
  } catch {
    return [];
  }
}

/** The blocks of a shortcut or a lead's quick card. */
export async function fetchMentionBlocks(handle: string): Promise<ChatBlock[]> {
  try {
    const response = await fetch(`/api/chat/mention?h=${encodeURIComponent(handle)}`, { cache: "no-store" });
    const body = (await response.json()) as { blocks?: ChatBlock[]; error?: string };
    if (response.ok && body.blocks) {
      menuCache = null; // counts may have changed
      return body.blocks;
    }
    return [{ type: "assistant", id: `mention-error-${Date.now()}`, text: body.error ?? "Não consegui buscar agora. Tente de novo." }];
  } catch {
    return [{ type: "assistant", id: `mention-error-${Date.now()}`, text: "Não consegui buscar agora. Confira a internet." }];
  }
}
