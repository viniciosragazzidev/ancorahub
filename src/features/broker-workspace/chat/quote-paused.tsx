"use client";

import { useMemo } from "react";

import { ChatScreen } from "@/components/chat/chat-screen";
import type { ChatScript } from "@/components/chat/types";

import { ASSISTANTS } from "./assistant-scripts";

/** The assistant Cotação while quotes are off: a resting mascot and one tap back to work. */
export function QuotePaused() {
  const definition = ASSISTANTS.cotacao;
  const script = useMemo<ChatScript>(() => ({
    status: { label: "Em pausa", tone: "idle" },
    blocks: [
      { type: "paused", id: "quote-paused", title: "A Cotação está de folga", text: "Por enquanto não vamos fazer cotação pelo app. Quando ela voltar, eu aviso você aqui.", shape: definition.shape, hue: definition.hue ?? 268 },
      {
        type: "question",
        id: "quote-paused-next",
        prompt: "Enquanto isso, o que você quer fazer?",
        choices: [
          { id: "leads", label: "Ver meus leads", action: { kind: "href", href: "/dashboard/c/leads" } },
          { id: "home", label: "Voltar ao Início", action: { kind: "href", href: "/dashboard" } },
        ],
      },
    ],
  }), [definition.hue, definition.shape]);

  return (
    <ChatScreen
      identity={{ name: definition.name, shape: definition.shape, hue: definition.hue }}
      backHref="/dashboard"
      script={script}
      composerDisabled
      placeholder="A cotação está em pausa"
    />
  );
}
