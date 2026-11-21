"use client";

import "@/components/arc/director-chrome.css";

import { useMemo, useState } from "react";
import { DirectChatTransport, simulateReadableStream, type ChatTransport, type UIMessage } from "ai";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";

import { AgentDrawer } from "@/components/agent-drawer/agent-drawer";
import { AgentDrawerProvider } from "@/components/agent-drawer/agent-drawer-provider";
import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { createDirectorAgent } from "@/features/agent/agent";
import { createMemoryBackend, sampleWorld } from "@/features/agent/backend-memory";
import { DevLabProvider, useDevLab, type DevLab } from "@/lib/dev-lab";

/**
 * Laboratório do Agente IA do diretor (21/11/2026): a gaveta real, as ferramentas reais e a política real, sobre um
 * mundo em memória (6 pessoas, duas Anas, 3 plantões por dia). O "modelo" é um roteiro: lê o pedido e os resultados
 * e chama as ferramentas como o modelo de verdade faria. Plano §6.3.
 */
type Prompt = Array<{ role: string; content: unknown }>;
type ToolResultLike = { toolName: string; value: Record<string, unknown> | null; denied: boolean };
type Step = { kind: "tool"; name: string; input: Record<string, unknown> } | { kind: "text"; text: string };

const LAB_PHRASES = [
  "Quem está no plantão agora?",
  "Onde falta gente na escala desta semana?",
  "Dê 3 cadeiras para a Ana",
  "Dê 2 cadeiras de sábado para a Carla",
  "Quantas cadeiras a Carla tem?",
  "Tire a Carla de todos os plantões das próximas 2 semanas",
];

function textOf(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (part && typeof part === "object" && (part as { type?: string }).type === "text" ? String((part as { text?: string }).text ?? "") : "")).join(" ");
}

/** O que aconteceu depois da última fala do diretor: resultados de ferramenta, na ordem. */
function readTurn(prompt: Prompt) {
  let lastUser = -1;
  prompt.forEach((message, index) => { if (message.role === "user") lastUser = index; });
  const request = lastUser >= 0 ? textOf(prompt[lastUser]!.content) : "";
  const results: ToolResultLike[] = [];
  for (const message of prompt.slice(lastUser + 1)) {
    if (message.role !== "tool" || !Array.isArray(message.content)) continue;
    for (const part of message.content as Array<{ type?: string; toolName?: string; output?: { type?: string; value?: unknown } }>) {
      if (part.type !== "tool-result" || !part.toolName) continue;
      const denied = part.output?.type === "execution-denied";
      const value = part.output?.type === "json" && part.output.value && typeof part.output.value === "object" ? part.output.value as Record<string, unknown> : null;
      results.push({ toolName: part.toolName, value, denied });
    }
  }
  return { request: request.toLowerCase(), results };
}

const NUMBER_WORDS: Record<string, number> = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, "três": 3, quatro: 4, cinco: 5, seis: 6 };

function personAsked(request: string) {
  const match = request.match(/(?:para|pra|a|o)\s+(?:a\s+|o\s+)?([a-zà-ú]+)(?:\s|\?|$)/g);
  const words = (match ?? []).map((chunk) => chunk.trim().split(/\s+/).at(-1)!.replace("?", ""));
  return words.reverse().find((word) => !["plantão", "plantao", "escala", "semana", "sábado", "sabado", "agora", "gente", "tem"].includes(word)) ?? null;
}

/** O roteiro: próximo passo a partir do pedido e do que já voltou. */
export function nextLabStep(prompt: Prompt): Step {
  const { request, results } = readTurn(prompt);
  const last = results.at(-1);
  const find = (name: string) => [...results].reverse().find((item) => item.toolName === name);
  if (last?.denied) return { kind: "text", text: "Tudo bem, não mudei nada." };

  if (request.includes("plantão agora") || request.includes("plantao agora")) {
    if (!last) return { kind: "tool", name: "plantao_agora", input: {} };
    return { kind: "text", text: String(last.value?.message ?? "") };
  }
  if (request.includes("falta gente")) {
    if (!last) return { kind: "tool", name: "plantao_escala", input: { so_faltando_gente: true } };
    return { kind: "text", text: String(last.value?.message ?? "") };
  }

  const name = personAsked(request);
  const people = find("pessoas_buscar");
  const chosen = find("escolher");
  if (!people) return name ? { kind: "tool", name: "pessoas_buscar", input: { texto: name } } : { kind: "text", text: "De quem você está falando?" };
  const found = (people.value?.data as { pessoas?: Array<{ id: string; nome: string; unidade: string | null }>; unico?: boolean } | undefined);
  if (!people.value?.ok || !found?.pessoas?.length) return { kind: "text", text: String(people.value?.message ?? "Não achei essa pessoa.") };
  if (!found.unico && !chosen) {
    return { kind: "tool", name: "escolher", input: { pergunta: "Qual delas?", opcoes: found.pessoas.map((person) => ({ id: person.id, rotulo: person.nome, detalhe: person.unidade ?? undefined })) } };
  }
  const personId = chosen ? String((chosen.value as { id?: string } | null)?.id ?? "") : found.pessoas[0]!.id;

  if (request.includes("quantas cadeiras")) {
    if (last?.toolName !== "plantao_escala") return { kind: "tool", name: "plantao_escala", input: { corretor_id: personId, ate: undefined } };
    return { kind: "text", text: String(last.value?.message ?? "") };
  }

  if (request.includes("tire") || request.includes("tira")) {
    const schedule = find("plantao_escala");
    if (!schedule) return { kind: "tool", name: "plantao_escala", input: { corretor_id: personId } };
    const ids = ((schedule.value?.data as { proximas?: Array<{ ocorrencia_id: string }> } | undefined)?.proximas ?? []).map((item) => item.ocorrencia_id);
    const removed = find("plantao_tirar_de_vagas");
    if (!removed) return ids.length ? { kind: "tool", name: "plantao_tirar_de_vagas", input: { corretor_id: personId, ocorrencia_ids: ids } } : { kind: "text", text: String(schedule.value?.message ?? "") };
    return { kind: "text", text: removed.value?.ok ? "Pronto." : String(removed.value?.message ?? "") };
  }

  if (request.includes("cadeira")) {
    const count = Number(request.match(/\b(\d{1,2})\b/)?.[1] ?? NUMBER_WORDS[request.match(/\b(uma|um|duas|dois|tres|três|quatro|cinco|seis)\b/)?.[1] ?? ""] ?? 1);
    const free = find("plantao_cadeiras_livres");
    if (!free) {
      const input: Record<string, unknown> = { corretor_id: personId, quantidade: count };
      if (request.includes("sábado") || request.includes("sabado")) input.dias_semana = [6];
      return { kind: "tool", name: "plantao_cadeiras_livres", input };
    }
    if (!free.value?.ok) return { kind: "text", text: String(free.value?.message ?? "") };
    const done = find("plantao_escalar_em_vagas");
    if (!done) {
      const ids = ((free.value.data as { vagas?: Array<{ ocorrencia_id: string }> }).vagas ?? []).map((vaga) => vaga.ocorrencia_id);
      return { kind: "tool", name: "plantao_escalar_em_vagas", input: { corretor_id: personId, ocorrencia_ids: ids } };
    }
    return { kind: "text", text: done.value?.ok ? "Pronto. Ela recebe o aviso no app." : String(done.value?.message ?? "Não deu certo.") };
  }

  return { kind: "text", text: "No laboratório eu entendo os pedidos prontos da lista." };
}

let callCounter = 0;
function scriptedModel(delayMs: number, fail: () => boolean) {
  return new MockLanguageModelV4({
    provider: "laboratorio",
    modelId: "roteiro",
    doStream: async (options) => {
      if (fail()) throw new Error("Modelo fora do ar (simulado).");
      const step = nextLabStep(options.prompt as unknown as Prompt);
      const usage = { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } };
      const chunks: LanguageModelV4StreamPart[] = step.kind === "tool"
        ? [
            { type: "tool-call" as const, toolCallId: `lab-${(callCounter += 1)}`, toolName: step.name, input: JSON.stringify(step.input) },
            { type: "finish" as const, finishReason: { unified: "tool-calls" as const, raw: undefined }, usage },
          ]
        : [
            { type: "text-start" as const, id: "t" },
            ...step.text.split(/(?<=\s)/).map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            { type: "text-end" as const, id: "t" },
            { type: "finish" as const, finishReason: { unified: "stop" as const, raw: undefined }, usage },
          ];
      return { stream: simulateReadableStream({ chunks, initialDelayInMs: delayMs, chunkDelayInMs: 15 }) };
    },
  });
}

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
