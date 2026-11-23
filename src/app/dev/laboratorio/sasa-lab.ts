/**
 * Sasá agêntica no laboratório (fase 1, 19/11/2026): o núcleo real (`runSasaCommand`) sobre um corretor de
 * mentira; só a ação do servidor é simulada, e ela muda esse mundo (pausar, marcar, desfazer) como a real.
 */
import type { ChatBlock, ChatServerActionName } from "@/components/chat/types";
import { SASA_ASK_PREFIX } from "@/features/broker-workspace/chat/assistant-scripts";
import { runSasaCommand, type SasaActionResult, type SasaWorld } from "@/features/sasa/command-core";
import { parseWhenPtBr } from "@/features/sasa/parse-when";
import { areasOf, isLeadLookup, SASA_AREA_LABEL, wantsAnalysis, type SasaArea } from "@/features/sasa/ecosystem-areas";
import { runSasaAgentLoop } from "@/features/sasa/ecosystem-agent";
import { answerFromFacts, factsToLines, leadLookupBlocks, type SasaFacts } from "@/features/sasa/ecosystem-answers";
import { resolveLead } from "@/features/sasa/resolve-entities";
import type { DevLab } from "@/lib/dev-lab";
import type { SasaVoiceBackend } from "@/features/sasa-voice/client";
import { charsLeftToday, clampVoiceText, keyLast4, pickDefaultVoice, SASA_VOICE_DAILY_CHARS, SASA_VOICE_TEST_TEXT, type SasaVoiceOption, type SasaVoiceState } from "@/features/sasa-voice/rules";

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
    // Fase 5: a Júlia chegou como oferta (aceitar ou recusar pela Sasá).
    offers: [{ leadId: "lab-julia", name: "Júlia Prado", expiresAt: at(4) }],
    // Recuperação (fase 5): "quem eu recupero hoje?" lista quem está parado sem retorno.
    recover: [
      { leadId: "lab-carlos-t", name: "Carlos Teixeira", status: "negotiation", since: at(-60 * 72) },
      { leadId: "lab-marina", name: "Marina Alves", status: "quote_sent", since: at(-60 * 50) },
    ],
  };
}

/** Pedidos prontos para tocar (o mesmo que digitar). */
/** Fase 4: falas prontas para o botão (painel "Próxima fala"). */
export const LAB_SASA_SPEECH = {
  venda: "Fechou a venda do Carlos Teixeira, Amil S380 familiar, 3 vidas, 35, 32 e 8 anos, R$ 1.290 por mês",
  disse: "A Ana disse que gostou da proposta e vai ver com o marido, me liga sexta às 10",
  cotacao: "Cotação para 3 vidas, 35, 32 e 8 anos, pessoa física",
  // Fase 5: sensíveis (confirma em um toque) e vários passos numa frase.
  aceitar: "Aceita o lead da Júlia",
  recusar: "Recusa, ela é de outra cidade",
  perdeu: "O Pedro desistiu, achou caro",
  mensagem: "Manda pra Ana que a proposta sai amanhã de manhã",
  passos: "Anota que a Ana vai pensar e marca retorno com ela sexta às 10",
} as const;

export const LAB_SASA_PHRASES = [
  LAB_SASA_SPEECH.disse,
  LAB_SASA_SPEECH.venda,
  LAB_SASA_SPEECH.cotacao,
  LAB_SASA_SPEECH.passos,
  LAB_SASA_SPEECH.aceitar,
  LAB_SASA_SPEECH.recusar,
  LAB_SASA_SPEECH.perdeu,
  LAB_SASA_SPEECH.mensagem,
  "Qual é meu próximo plantão?",
  "Pausa meu plantão",
  "Quem está esperando resposta?",
  "Quem eu recupero hoje?",
  "O que tenho na agenda hoje?",
  "Marca retorno com a Ana amanhã às 10",
  "Marca retorno com o Carlos sexta às 15h",
  "Já liguei pro Pedro",
  "Mandei a cotação pro Carlos Mendes",
  "Marca retorno com o Roberto amanhã",
];

/**
 * Ecossistema do corretor no laboratório (19/11): os mesmos fatos que as telas mostrariam, para as respostas diretas
 * rodarem com o código real (`answerFromFacts`). As perguntas abertas usam a camada limitada real
 * (`runSasaAgentLoop`) com um modelo de mentira que segue um roteiro.
 */
export function labSasaFacts(now = new Date()): SasaFacts {
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  const day = (days: number) => at(days * 1440);
  return {
    leads: {
      active: 5, byStatus: { negotiation: 1, in_contact: 2, quote_sent: 1, new: 1 }, newCount: 1, receivedToday: 3, acceptedToday: 2,
      waiting: [{ name: "Carlos Mendes", reason: "respondeu", minutes: 25, urgent: false }, { name: "Júlia Prado", reason: "lead novo", minutes: 6, urgent: true }],
    },
    lead: { kind: "one", id: "lab-ana", since: day(-2), name: "Ana Souza", status: "quote_sent", tipo: "familiar", arrivedAt: day(-3), summary: "Família de 3, quer Amil ou SulAmérica até R$ 1.500.", nextStep: "Ligar para tirar a dúvida da carência do filho.", objections: ["preço"], lastMessage: { from: "cliente", text: "Vou ver com meu marido e te falo", at: at(-120) }, notes: [{ at: day(-1), text: "Pediu a cotação da Amil S380" }] },
    wallet: { total: 42, attention: 3, renewalCount: 2, hasRenewalData: true, renewals: [{ name: "Marcos Lima", from: "02/12" }, { name: "Paula Reis", from: "15/12" }], anniversaries: [{ name: "Rita Alves", on: day(9), years: 1 }] },
    duty: {
      active: [{ name: "TESTE", startsAt: at(-60), endsAt: at(300), paused: false, presence: "confirmed" }],
      next: { name: "PME Manhã", startsAt: day(1), endsAt: at(1440 + 240) },
      week: [{ name: "PME Manhã", startsAt: day(1), endsAt: at(1440 + 240) }, { name: "Presencial Centro", startsAt: day(3), endsAt: at(3 * 1440 + 480) }],
      presenceAsk: null,
    },
    agenda: { items: [{ lead: "Ana Souza", title: "Retornar contato", dueAt: at(-60) }, { lead: "Pedro Lima", title: "Retornar contato hoje", dueAt: at(120) }, { lead: "Carlos Teixeira", title: "Retornar contato", dueAt: day(2) }] },
    performance: {
      today: { received: 3, accepted: 2, returnsDue: 2, awaiting: 2 },
      goal: { name: "Vendas de novembro", current: "6", target: "10", percentage: 60 },
      week: { offered: 20, accepted: 17, started: 15, medianAcceptSeconds: 48, medianStartSeconds: 420 },
      ranks: [{ position: 2, total: 12, label: "nos que mais aceitam" }],
    },
    finance: {
      access: true, periodLabel: "novembro de 2026", receivableCents: 345_000, receivedThisMonthCents: 128_050, openAdvancesCents: 0,
      forecast: [{ label: "nov/26", cents: 98_000 }, { label: "dez/26", cents: 112_500 }, { label: "jan/27", cents: 87_000 }],
      nextInstallment: { label: "12/2026", cents: 45_000, client: "Marcos Lima" },
    },
    sales: { monthLabel: "novembro", monthCount: 4, monthValue: 5_960, totalCount: 31, totalValue: 41_870, last: [{ on: day(-2), client: "Marcos Lima", plan: "Amil S380", value: 1_290 }, { on: day(-6), client: "Paula Reis", plan: "SulAmérica Exato", value: 1_870 }] },
    quotes: { quotes: [{ lead: "Ana Souza", status: "sent", total: 1_290, at: day(-1) }, { lead: "Pedro Lima", status: "draft", total: null, at: at(-90) }], proposals: [{ lead: "Carlos Teixeira", title: "Familiar Amil", status: "negociacao", total: 1_890, at: day(-2) }] },
    notifications: { unread: 2, items: [{ title: "Escala de dezembro publicada", at: at(-30), unread: true }, { title: "Recado da gestão", at: at(-200), unread: true }, { title: "Meta atualizada", at: day(-1), unread: false }] },
    account: { whatsapp: "connected", connectedAt: day(-12), availability: "available" },
  };
}

/** Perguntas prontas: as do usuário (comissões e vendas) e uma de cada área. */
export const LAB_SASA_QUESTIONS: Array<[SasaArea, string]> = [
  ["finance", "Quanto tenho a receber?"],
  ["finance", "Quanto recebi este mês?"],
  ["finance", "Quanto vou receber no mês que vem?"],
  ["sales", "Quantas vendas fiz este mês?"],
  ["sales", "Quais foram minhas últimas vendas?"],
  ["sales", "Quanto vendi em valor?"],
  ["leads", "Quantos leads novos eu tenho?"],
  ["leads", "Quem está esperando resposta e há quanto tempo?"],
  ["lead", "Me fala da Ana Souza"],
  ["wallet", "Quais clientes renovam nos próximos 90 dias?"],
  ["wallet", "Tem aniversário de contrato chegando?"],
  ["duty", "Qual é minha escala da semana?"],
  ["duty", "Estou confirmado no plantão?"],
  ["agenda", "Quais retornos tenho na semana?"],
  ["performance", "Quanto falta para a meta?"],
  ["performance", "Qual meu tempo de primeira resposta?"],
  ["quotes", "Quais propostas estão pendentes?"],
  ["notifications", "O que tenho de novo nos avisos?"],
  ["account", "Meu WhatsApp está conectado?"],
  ["account", "Estou disponível ou pausado?"],
];

/** Perguntas abertas (IA limitada) e o caso que estoura o teto de consultas. */
export const LAB_SASA_OPEN = [
  "Como foi minha semana comparada à anterior?",
  "Qual lead devo priorizar agora?",
  "Resume o Carlos Mendes pra mim",
  "Analisa tudo: leads, carteira, agenda, comissões e vendas",
];

export function labSasaQuestionsBlock(): ChatBlock {
  return {
    type: "question",
    id: "lab-sasa-questions",
    prompt: "Laboratório: pergunte sobre cada área.",
    choices: LAB_SASA_QUESTIONS.map(([area, text], index) => ({ id: `lab-q-${index}`, label: text, hint: SASA_AREA_LABEL[area], action: { kind: "local", value: `${SASA_ASK_PREFIX}${text}` } })),
  };
}

export function labSasaOpenBlock(): ChatBlock {
  return {
    type: "question",
    id: "lab-sasa-open",
    prompt: "Laboratório: perguntas abertas (IA limitada, simulada).",
    choices: LAB_SASA_OPEN.map((text, index) => ({ id: `lab-open-${index}`, label: text, hint: index === LAB_SASA_OPEN.length - 1 ? "Estoura o teto de 4 consultas" : "Até 4 consultas", action: { kind: "local", value: `${SASA_ASK_PREFIX}${text}` } })),
  };
}

/** Roteiro do modelo de mentira: as leituras que ele pediria e a resposta no fim (null = nunca responde). */
const LAB_AGENT_SCRIPTS: Record<string, { reads: Array<{ area: SasaArea; lead?: string }>; answer: string | null }> = {
  [LAB_SASA_OPEN[0]!]: { reads: [{ area: "performance" }, { area: "sales" }], answer: "Nos últimos 7 dias você aceitou 17 de 20 ofertas e registrou 4 vendas no mês. Não tenho a semana anterior separada, então não consigo comparar com precisão." },
  [LAB_SASA_OPEN[1]!]: { reads: [{ area: "leads" }, { area: "agenda" }], answer: "Comece pela Júlia: lead novo esperando há 6 min e o 1º contato está atrasando. Depois o Carlos, que respondeu há 25 min, e o retorno atrasado da Ana." },
  [LAB_SASA_OPEN[2]!]: { reads: [{ area: "lead", lead: "Carlos Mendes" }], answer: "O Carlos está em atendimento e respondeu há 25 min esperando você. Não tenho notas dele ainda." },
  [LAB_SASA_OPEN[3]!]: { reads: [{ area: "leads" }, { area: "wallet" }, { area: "agenda" }, { area: "finance" }, { area: "sales" }], answer: null },
};

/** No laboratório: resposta direta pelos fatos de exemplo; aberta pela camada limitada com o modelo de mentira. */
export async function labSasaAsk(question: string, world: SasaWorld, now = new Date()): Promise<ChatBlock[]> {
  const facts = labSasaFacts(now);
  let areas = areasOf(question);
  const named = resolveLead(question, world.leads);
  if (named.kind !== "none" || isLeadLookup(question)) areas = ["lead", ...areas.filter((area) => area !== "lead" && area !== "leads")];
  if (areas[0] === "lead" && !wantsAnalysis(question)) {
    // Consulta de lead no laboratório: o achado (ou a falta dele) vem do corretor de mentira.
    const lead = named.kind === "one" ? { ...(facts.lead as Extract<NonNullable<SasaFacts["lead"]>, { kind: "one" }>), id: named.lead.id, name: named.lead.name, status: named.lead.status }
      : named.kind === "many" ? { kind: "many" as const, names: named.leads.map((item) => item.name), leads: named.leads.map((item) => ({ id: item.id, name: item.name })) }
        : { kind: "none" as const, asked: null };
    const blocks = leadLookupBlocks({ lead }, now, String(Date.now()));
    if (blocks) return blocks;
  }
  const direct = wantsAnalysis(question) ? [] : areas.slice(0, 2).map((area) => answerFromFacts(question, area, facts, now)).filter((text): text is string => Boolean(text));
  const say = (text: string): ChatBlock[] => [{ type: "assistant", id: `lab-ask-${Date.now()}`, text }];
  if (direct.length) return say(direct.join(" "));
  const script = LAB_AGENT_SCRIPTS[question] ?? { reads: [{ area: "leads" as SasaArea }], answer: "No laboratório, esta pergunta aberta usaria a IA limitada; aqui só mostro o caminho: li seus leads." };
  let step = 0;
  const result = await runSasaAgentLoop({
    question,
    hint: areas,
    read: async (area) => factsToLines(area, facts, now),
    ask: async () => {
      const next = script.reads[step];
      step += 1;
      if (next) return { action: "read", area: next.area, lead: next.lead ?? null, text: null };
      return script.answer ? { action: "answer", area: null, lead: null, text: script.answer } : { action: "read", area: "notifications", lead: null, text: null };
    },
  });
  return say(result.truncated ? `${result.text} (IA limitada: ${result.reads.length} consultas, teto atingido)` : result.text);
}

export function labSasaPhrasesBlock(): ChatBlock {
  return {
    type: "question",
    id: "lab-sasa-phrases",
    prompt: "Laboratório: toque num pedido ou escreva o seu.",
    choices: LAB_SASA_PHRASES.map((text, index) => ({ id: `lab-phrase-${index}`, label: text, action: { kind: "local", value: `${SASA_ASK_PREFIX}${text}` } })),
  };
}

const PRESET_MINUTES: Record<string, number> = { today: 60, tomorrow: 60 * 24, in_2_days: 60 * 48, in_3_days: 60 * 72 };

/** Vozes de mentira do laboratório (a padrão é o senhor idoso pt-BR, como no servidor). */
export const LAB_VOICES: SasaVoiceOption[] = [
  { id: "lab-en", name: "Rachel (simulada)", language: "en", gender: "female", age: "young" },
  { id: "lab-pt", name: "Sasá Brasil (simulada)", language: "pt-BR", gender: "female", age: "middle_aged" },
  { id: "lab-senhor", name: "Seu Antônio (simulada)", language: "pt-BR", gender: "male", age: "old", accent: "brazilian" },
];

/** Um bipe curto em WAV no lugar do MP3 do ElevenLabs (o laboratório não chama a API). */
export function labVoiceAudio(seconds = 0.5): Blob {
  const rate = 22_050;
  const samples = Math.round(rate * seconds);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const fade = Math.min(1, i / 600, (samples - i) / 600);
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 520 * i) / rate) * 0.25 * fade * 32767), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

type LabVoice = { key: string | null; voiceId: string | null; voiceName: string | null; enabled: boolean; usedToday: number };

/**
 * Voz do Sasá no laboratório (teste de 23/11): conectar, trocar a voz, testar e desconectar como no servidor, sem
 * chamar o ElevenLabs. "Servidor responde: Falha" faz a key ser recusada e a fala falhar (fica só o texto).
 */
export function createLabVoice(voice: LabVoice, options: { delay: number; outcome: LabOutcome }): SasaVoiceBackend {
  const stateOf = (): SasaVoiceState => ({ allowed: true, canManage: true, companyEnabled: Boolean(voice.key) && voice.enabled, connected: Boolean(voice.key), keyLast4: voice.key ? keyLast4(voice.key) : null, voiceId: voice.voiceId, voiceName: voice.voiceName, enabled: voice.enabled, usedToday: voice.usedToday, dailyLimit: SASA_VOICE_DAILY_CHARS });
  const failing = () => options.outcome === "falha";
  return {
    state: async () => { await wait(Math.min(options.delay, 300)); return stateOf(); },
    connect: async (apiKey) => {
      await wait(options.delay);
      if (apiKey.trim().length < 20) return { ok: false, error: "Cole a key inteira do ElevenLabs." };
      if (failing()) return { ok: false, error: "Não consegui falar com o ElevenLabs: a key do ElevenLabs foi recusada." };
      const picked = LAB_VOICES.find((item) => item.id === voice.voiceId) ?? pickDefaultVoice(LAB_VOICES)!;
      Object.assign(voice, { key: apiKey.trim(), voiceId: picked.id, voiceName: picked.name });
      return { ok: true, state: stateOf(), voices: LAB_VOICES };
    },
    voices: async () => { await wait(Math.min(options.delay, 300)); return voice.key ? { ok: true, state: stateOf(), voices: LAB_VOICES } : { ok: false, error: "Conecte a key do ElevenLabs primeiro." }; },
    choose: async ({ voiceId, voiceName }) => { await wait(Math.min(options.delay, 300)); Object.assign(voice, { voiceId, voiceName }); return { ok: true, state: stateOf() }; },
    setEnabled: async (enabled) => { await wait(Math.min(options.delay, 300)); voice.enabled = enabled; return { ok: true, state: stateOf() }; },
    disconnect: async () => { await wait(options.delay); if (failing()) return { ok: false, error: "Não consegui desconectar agora. A key continua guardada." }; Object.assign(voice, { key: null, voiceId: null, voiceName: null }); return { ok: true, state: stateOf() }; },
    speak: async ({ text, test }) => {
      await wait(options.delay);
      if (!voice.key) return { ok: false, reason: "a voz não está conectada" };
      const spoken = clampVoiceText(test ? SASA_VOICE_TEST_TEXT : text ?? "");
      if (charsLeftToday(voice.usedToday) < spoken.length) return { ok: false, reason: "acabou a cota de voz de hoje" };
      if (failing()) return { ok: false, reason: "o ElevenLabs está fora do ar (simulado)" };
      voice.usedToday += spoken.length;
      return { ok: true, audio: labVoiceAudio(Math.min(2, 0.3 + spoken.length / 200)) };
    },
  };
}

export function createLabSasa(state: { world: SasaWorld; closed: SasaWorld["returns"]; heard?: number; offline?: boolean; nextSpeech?: string | null; voice?: LabVoice }, options: { delay: number; outcome: LabOutcome }): NonNullable<DevLab["sasa"]> {
  state.voice ??= { key: null, voiceId: null, voiceName: null, enabled: true, usedToday: 0 };
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
      case "lead.accept": {
        const offer = world.offers?.find((item) => item.leadId === payload.leadId);
        if (!offer) return { ok: false, message: "A oferta expirou ou foi para outro corretor. Nada foi alterado." };
        world.offers = world.offers?.filter((item) => item !== offer);
        const lead = world.leads.find((item) => item.id === offer.leadId);
        if (lead) lead.status = "in_contact";
        return { ok: true, message: "Aceito. Abrindo o WhatsApp do cliente com a mensagem pronta (simulado)." };
      }
      case "lead.decline": {
        world.offers = world.offers?.filter((item) => item.leadId !== payload.leadId);
        world.leads = world.leads.filter((item) => item.id !== payload.leadId);
        return { ok: true, message: `Recusado (${payload.reason}). Ele volta para a fila e vai para outro corretor.` };
      }
      case "lead.markLost": {
        const lead = world.leads.find((item) => item.id === payload.leadId);
        if (!lead) return { ok: false, message: "Lead não encontrado." };
        const previous = payload.previous || lead.status;
        lead.status = "lost";
        return { ok: true, message: "Registrei. O atendimento foi encerrado e conta no seu histórico.", undo: undo("Desfazer", "lead.restoreStep", { leadId: lead.id, status: previous }) };
      }
      case "sasa.plan": {
        // Mesmo laço do servidor: passo a passo, para no primeiro que falhar.
        const steps = JSON.parse(payload.steps || "[]") as Array<{ name: ChatServerActionName; payload: Record<string, string>; label?: string }>;
        const undos: Array<{ name: ChatServerActionName; payload: Record<string, string> }> = [];
        for (const step of steps) {
          const result = await run(step.name, step.payload);
          if (!result.ok) return { ok: false, message: `Não consegui: ${step.label ?? step.name}.` };
          if (result.undo) undos.push({ name: result.undo.action.name, payload: result.undo.action.payload });
        }
        return { ok: true, message: steps.length === 1 ? "Pronto." : `Pronto, fiz as ${steps.length} coisas.`, undo: undos.length ? undo("Desfazer", "sasa.plan", { steps: JSON.stringify(undos.reverse()) }) : undefined };
      }
      default: return { ok: true, message: "Pronto (simulado)." };
    }
  };
  return {
    run,
    voice: createLabVoice(state.voice, options),
    ask: async (question: string) => { await wait(Math.min(options.delay, 600)); return labSasaAsk(question, state.world); },
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
      return runSasaCommand({
        ...input, recordedAt: input.recordedAt ? new Date(input.recordedAt) : null, world: state.world, run: (name, payload) => run(name, payload),
        // Telefone de mentira só para lead já aceito (como no servidor: lead novo não revela o contato).
        contactOf: async (leadId) => { const lead = state.world.leads.find((item) => item.id === leadId); return lead && lead.status !== "new" ? "21999990000" : null; },
      });
    },
  };
}
