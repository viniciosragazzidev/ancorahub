import type { ReactNode } from "react";

export function AssistantPanel({ children }: { children?: ReactNode }) {
  return <aside aria-label="AncoraHub Assistant" className="ancorahub-assistant-panel"><header><strong>AncoraHub Assistant</strong><span>Contexto seguro do atendimento</span></header>{children}</aside>;
}
