"use client";

import "@/components/arc/director-chrome.css";

import { useMemo, useState } from "react";
import { DirectChatTransport, type ChatTransport, type UIMessage } from "ai";

import { AgentDrawer } from "@/components/agent-drawer/agent-drawer";
import { AgentDrawerProvider } from "@/components/agent-drawer/agent-drawer-provider";
import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { createDirectorAgent } from "@/features/agent/agent";
import { createMemoryBackend, sampleWorld } from "@/features/agent/backend-memory";
import { DevLabProvider, useDevLab, type DevLab } from "@/lib/dev-lab";

import { LAB_PHRASES, scriptedModel } from "./director-agent-script";

/**
 * Laboratório do Agente IA do diretor (21/11/2026): a gaveta real, as ferramentas reais e a política real, sobre um
 * mundo em memória (6 pessoas, duas Anas, 3 plantões por dia). O "modelo" é um roteiro: lê o pedido e os resultados
 * e chama as ferramentas como o modelo de verdade faria. Plano §6.3.
 */
function OpenDrawerButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-agent-drawer"))}
      style={{ minHeight: 36, padding: "0 14px", border: "1px solid #e5e5e5", borderRadius: 8, background: "#ffffff", fontWeight: 500, cursor: "pointer" }}
    >
      Abrir o Agente IA (Ctrl+J)
    </button>
  );
}

export function DirectorAgentLab({ delayMs, failServer, run }: { delayMs: number; failServer: boolean; run: number }) {
  const parent = useDevLab();
  const [writes, setWrites] = useState(true);
  const [modelDown, setModelDown] = useState(false);
  const backend = useMemo(() => createMemoryBackend(sampleWorld(new Date())), [run]); // eslint-disable-line react-hooks/exhaustive-deps
  backend.world.failWrites = failServer;

  const lab: DevLab = useMemo(() => {
    const viewer = { role: "director", viewAs: false, writesEnabled: writes };
    const transport: ChatTransport<UIMessage> = {
      sendMessages: async (options) => {
        const agent = createDirectorAgent({ model: scriptedModel(delayMs, () => modelDown), backend, viewer, firstName: "Vinicios", messages: options.messages });
        return new DirectChatTransport({ agent }).sendMessages(options as never) as ReturnType<ChatTransport<UIMessage>["sendMessages"]>;
      },
      reconnectToStream: async () => null,
    };
    return {
      ...(parent ?? {}),
      directorAgent: {
        transport,
        undo: async (actionId: string) => {
          const action = backend.actions.find((item) => item.id === actionId);
          if (!action?.undo || action.undone) return { ok: false, message: "Esta ação não pode mais ser desfeita." };
          action.undone = true;
          const { buildAgentTools } = await import("@/features/agent/tools");
          const tools = buildAgentTools({ backend, requestText: "Desfazer", approvedByUser: () => true });
          const tool = (tools as unknown as Record<string, { execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<{ ok: boolean; message: string }> }>)[action.undo.tool]!;
          const result = await tool.execute(action.undo.input, { toolCallId: `undo:${actionId}:${Date.now()}`, messages: [] });
          if (!result.ok) action.undone = false;
          return { ok: result.ok, message: result.ok ? `Desfeito. ${result.message}` : result.message };
        },
      },
    };
  }, [parent, writes, delayMs, modelDown, backend]);

  return (
    <DevLabProvider value={lab}>
      <ArcScopeProvider enabled>
        <AgentDrawerProvider>
          <div className="arc-venancor" data-skin="diretor" style={{ minHeight: "100%", padding: 24, display: "grid", gap: 16, alignContent: "start", background: "var(--surface)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <OpenDrawerButton />
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={writes} onChange={(event) => setWrites(event.target.checked)} /> Ações liberadas na empresa
              </label>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={modelDown} onChange={(event) => setModelDown(event.target.checked)} /> IA fora do ar
              </label>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "grid", gap: 4 }}>
              <span>Pedidos prontos (copie para a gaveta):</span>
              {LAB_PHRASES.map((phrase) => <code key={phrase}>{phrase}</code>)}
              <span>Mundo: Ana Souza e Ana Paula Lima (duas Anas), Bruno (pausado), Carla, Diego (inativo); Manhã, Tarde e Online por 14 dias.</span>
            </div>
          </div>
          <AgentDrawer />
        </AgentDrawerProvider>
      </ArcScopeProvider>
    </DevLabProvider>
  );
}
