import type { ReactNode } from "react";

export function AssistantPanel({ children }: { children?: ReactNode }) {
  return <aside aria-label="CorreTop Assistant" className="corretop-assistant-panel"><header><strong>CorreTop Assistant</strong><span>Contexto seguro do atendimento</span></header>{children}</aside>;
}
