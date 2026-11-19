/**
 * Sasá agêntica no laboratório (fase 1, 19/11/2026): o núcleo real (`runSasaCommand`) sobre um corretor de
 * mentira; só a ação do servidor é simulada, e ela muda esse mundo (pausar, marcar, desfazer) como a real.
 */
import type { ChatBlock, ChatServerActionName } from "@/components/chat/types";
import { SASA_ASK_PREFIX } from "@/features/broker-workspace/chat/assistant-scripts";
import { runSasaCommand, type SasaActionResult, type SasaWorld } from "@/features/sasa/command-core";
import { parseWhenPtBr } from "@/features/sasa/parse-when";
import type { DevLab } from "@/lib/dev-lab";

/** O que o "microfone" do laboratório ouve, em ordem: o segundo vem com a hora errada, para testar o Corrigir. */
export const LAB_SASA_VOICE = [
  "marca retorno com a Ana amanhã às 10",
  "marca retorno com o Pedro amanhã às 11",
  "pausa meu plantão",
  "quem está esperando resposta",
];

export type LabOutcome = "ok" | "falha" | "liberacao";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `00000000-0000-4000-8000-${String(Date.now()).padStart(12, "0").slice(-12)}`);

/** Corretor de exemplo: dois Carlos (para a escolha por toque), retorno atrasado e gente esperando. */
export function labSasaWorld(now = new Date()): SasaWorld {
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  return {
    now,
    availability: "available",
    leads: [
      { id: "lab-carlos-t", name: "Carlos Teixeira", status: "negotiation" },
      { id: "lab-carlos-m", name: "Carlos Mendes", status: "in_contact" },
      { id: "lab-ana", name: "Ana Souza", status: "quote_sent" },
      { id: "lab-pedro", name: "Pedro Lima", status: "in_contact" },
      { id: "lab-julia", name: "Júlia Prado", status: "new" },
    ],
    returns: [
      { taskId: id(), leadId: "lab-ana", leadName: "Ana Souza", title: "Retornar contato hoje", dueAt: at(-60) },
      { taskId: id(), leadId: "lab-pedro", leadName: "Pedro Lima", title: "Retornar contato hoje", dueAt: at(120) },
    ],
    waiting: [
      { leadId: "lab-carlos-m", name: "Carlos Mendes", context: "Respondeu e espera você", urgent: false },
      { leadId: "lab-julia", name: "Júlia Prado", context: "Esperando o 1º contato", urgent: true },
    ],
    duty: {
      active: { name: "TESTE", startsAt: at(-60), endsAt: at(300) },
      next: { name: "PME Manhã", startsAt: at(60 * 20), endsAt: at(60 * 24) },
    },
  };
}

/** Pedidos prontos para tocar (o mesmo que digitar). */
/** Fase 4: falas prontas para o botão (painel "Próxima fala"). */
export const LAB_SASA_SPEECH = {
  venda: "Fechou a venda do Carlos Teixeira, Amil S380 familiar, 3 vidas, 35, 32 e 8 anos, R$ 1.290 por mês",
  disse: "A Ana disse que gostou da proposta e vai ver com o marido, me liga sexta às 10",
  cotacao: "Cotação para 3 vidas, 35, 32 e 8 anos, pessoa física",
} as const;

export const LAB_SASA_PHRASES = [
  LAB_SASA_SPEECH.disse,
  LAB_SASA_SPEECH.venda,
  LAB_SASA_SPEECH.cotacao,
  "Qual é meu próximo plantão?",
  "Pausa meu plantão",
  "Quem está esperando resposta?",
  "O que tenho na agenda hoje?",
  "Marca retorno com a Ana amanhã às 10",
  "Marca retorno com o Carlos sexta às 15h",
  "Já liguei pro Pedro",
  "Mandei a cotação pro Carlos Mendes",
  "Marca retorno com o Roberto amanhã",
];

export function labSasaPhrasesBlock(): ChatBlock {
  return {
    type: "question",
    id: "lab-sasa-phrases",
    prompt: "Laboratório: toque num pedido ou escreva o seu.",
    choices: LAB_SASA_PHRASES.map((text, index) => ({ id: `lab-phrase-${index}`, label: text, action: { kind: "local", value: `${SASA_ASK_PREFIX}${text}` } })),
  };
}

const PRESET_MINUTES: Record<string, number> = { today: 60, tomorrow: 60 * 24, in_2_days: 60 * 48, in_3_days: 60 * 72 };

export function createLabSasa(state: { world: SasaWorld; closed: SasaWorld["returns"]; heard?: number; offline?: boolean; nextSpeech?: string | null }, options: { delay: number; outcome: LabOutcome }): NonNullable<DevLab["sasa"]> {
  const run = async (name: ChatServerActionName, raw: Record<string, string | number | boolean | null>): Promise<SasaActionResult> => {
    await wait(options.delay);
    if (options.outcome === "falha") return { ok: false, message: "O servidor recusou (simulado). Nada foi alterado." };
    const payload = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value ?? "")]));
    const world = state.world;
    const undo = (label: string, action: ChatServerActionName, data: Record<string, string>) => ({ label, action: { kind: "server" as const, name: action, payload: data } });
    const close = (taskId: string) => {
      const task = world.returns.find((item) => item.taskId === taskId);
      if (task) { world.returns = world.returns.filter((item) => item !== task); state.closed.push(task); }
    };
    const reopen = (taskId: string) => {
      const task = state.closed.find((item) => item.taskId === taskId);
      if (task) { state.closed = state.closed.filter((item) => item !== task); world.returns.push(task); }
    };
    switch (name) {
      case "duty.pause": world.availability = "paused"; return { ok: true, message: "Pausei você.", undo: undo("Desfazer", "duty.resume", {}) };
      case "duty.resume": world.availability = "available"; return { ok: true, message: "Pronto, você voltou a receber leads.", undo: undo("Desfazer", "duty.pause", {}) };
      case "lead.scheduleReturn": {
        const lead = world.leads.find((item) => item.id === payload.leadId);
        if (!lead) return { ok: false, message: "Lead não encontrado." };
        const dueAt = payload.at ? new Date(payload.at) : parseWhenPtBr("amanhã", new Date())?.at ?? new Date(Date.now() + (PRESET_MINUTES[payload.when] ?? 60) * 60_000);
        if (payload.taskId) close(payload.taskId);
        const taskId = id();
        world.returns.push({ taskId, leadId: lead.id, leadName: lead.name, title: "Retornar contato", dueAt });
        return { ok: true, message: "Combinado. O retorno está na sua Agenda.", undo: undo("Desfazer", "lead.undoReturn", { taskId, ...(payload.taskId ? { reopenTaskId: payload.taskId } : {}) }) };
      }
      case "lead.undoReturn": close(payload.taskId); if (payload.reopenTaskId) reopen(payload.reopenTaskId); return { ok: true, message: "Desfeito." };
      case "lead.completeReturn": close(payload.taskId); return { ok: true, message: "Boa. Tirei esse retorno da sua Agenda.", undo: undo("Desfazer", "lead.reopenReturn", { taskId: payload.taskId }) };
      case "lead.cancelReturn": close(payload.taskId); return { ok: true, message: "Cancelei o retorno.", undo: undo("Desfazer", "lead.reopenReturn", { taskId: payload.taskId }) };
      case "lead.reopenReturn": reopen(payload.taskId); return { ok: true, message: "Pronto, o retorno voltou para a sua Agenda." };
      case "lead.changeStep":
      case "lead.restoreStep": {
        const lead = world.leads.find((item) => item.id === payload.leadId);
        if (!lead) return { ok: false, message: "Lead não encontrado." };
        const previous = lead.status;
        lead.status = payload.status;
        return name === "lead.changeStep"
          ? { ok: true, message: "Pronto.", undo: undo("Desfazer", "lead.restoreStep", { leadId: lead.id, status: previous }) }
          : { ok: true, message: "Desfeito. A etapa voltou a ser a de antes." };
      }
      default: return { ok: true, message: "Pronto (simulado)." };
    }
  };
  return {
    run,
    simulateMic: true,
    get offline() { return Boolean(state.offline); },
    transcribe: async () => {
      if (state.offline) throw new TypeError("Failed to fetch");
      await wait(options.delay);
      if (options.outcome === "falha") return { ok: false, error: "Não consegui entender o áudio. Tente de novo ou escreva." };
      if (state.nextSpeech) { const text = state.nextSpeech; state.nextSpeech = null; return { ok: true, text }; }
      const index = state.heard ?? 0;
      state.heard = index + 1;
      return { ok: true, text: LAB_SASA_VOICE[index % LAB_SASA_VOICE.length]! };
    },
    command: async (input) => {
      if (state.offline) throw new TypeError("Failed to fetch");
      await wait(Math.min(options.delay, 600));
      state.world.now = new Date();
      return runSasaCommand({ ...input, recordedAt: input.recordedAt ? new Date(input.recordedAt) : null, world: state.world, run: (name, payload) => run(name, payload) });
    },
  };
}
