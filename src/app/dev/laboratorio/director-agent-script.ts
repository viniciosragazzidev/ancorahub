import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";

/**
 * Roteiro do laboratório do Agente IA do diretor: faz o papel do modelo, lendo o pedido e os resultados das
 * ferramentas e chamando a próxima, como o modelo de verdade faria. Puro e testado (director-agent-script.test.ts).
 */
type Prompt = Array<{ role: string; content: unknown }>;
type ToolResultLike = { toolName: string; value: Record<string, unknown> | null; denied: boolean };
type Step = { kind: "tool"; name: string; input: Record<string, unknown> } | { kind: "text"; text: string };

export const LAB_PHRASES = [
  "Quem está no plantão agora?",
  "Onde falta gente na escala desta semana?",
  "Dê 3 cadeiras para a Ana",
  "Dê 2 cadeiras de sábado para a Carla",
  "Quantas cadeiras a Carla tem?",
  "Tire a Carla de todos os plantões das próximas 2 semanas",
  "Escala o Bruno no plantão da manhã de amanhã",
  "Escala a Carla no plantão de segunda",
  "Tira a Carla do plantão de terça",
  "Pausa o Bruno no plantão",
  "Volta o Bruno no plantão",
  "Pausa o Bruno",
  "Ativa o Bruno",
  "Passa a cadeira da Carla de terça para a Ana Souza",
  "Troca a Carla de terça com o Bruno de quarta",
  "A Carla faltou hoje",
  "Tira a falta da Carla",
  "Libera a presença do Bruno, ele está aqui",
  "De quem é a vez?",
  "Põe a Carla primeiro no rodízio",
  "Volta o rodízio pro automático",
  "A Carla vai fazer online hoje",
  "Manda de novo o aviso de presença pra Carla",
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
  const system = prompt.filter((message) => message.role === "system").map((message) => textOf(message.content)).join(" ");
  return { request: request.toLowerCase(), results, system };
}

const WEEKDAY_WORDS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "amanhã", "hoje", "de sexta" → AAAA-MM-DD, pelo calendário que o prompt traz (como o modelo faria). */
function dayAsked(request: string, system: string) {
  const calendar = system.match(/Calendário: ([^\n]+)/)?.[1] ?? "";
  const entries = calendar.split(";").map((item) => item.trim()).filter(Boolean);
  const pick = (test: (entry: string) => boolean) => entries.find(test)?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  if (/\bamanh[ãa]/.test(request)) return pick((entry) => entry.includes("(amanhã)"));
  if (/\bhoje\b/.test(request)) return pick((entry) => entry.includes("(hoje)"));
  const weekday = WEEKDAY_WORDS.find((word) => request.includes(word) || request.includes(word.normalize("NFD").replace(/[̀-ͯ]/g, "")));
  return weekday ? pick((entry) => entry.startsWith(weekday) && !entry.includes("(hoje)")) : null;
}

function lastCalendarDay(system: string) {
  const days = (system.match(/Calendário: ([^\n]+)/)?.[1] ?? "").match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return days.at(-1) ?? null;
}

function shiftAsked(request: string) {
  if (/manh[ãa]/.test(request)) return "manha";
  if (request.includes("tarde")) return "tarde";
  if (request.includes("noite")) return "noite";
  return undefined;
}

const NUMBER_WORDS: Record<string, number> = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, "três": 3, quatro: 4, cinco: 5, seis: 6 };

function personAsked(request: string) {
  const match = request.match(/(?:^|\s)(?:para|pra|a|o)\s+(?:a\s+|o\s+)?([a-zà-ú]+)(?=\s|\?|$)/g);
  const words = (match ?? []).map((chunk) => chunk.trim().split(/\s+/).at(-1)!.replace("?", ""));
  return words.reverse().find((word) => !["plantão", "plantao", "escala", "semana", "sábado", "sabado", "agora", "gente", "tem"].includes(word)) ?? null;
}

/** O roteiro: próximo passo a partir do pedido e do que já voltou. */
export function nextLabStep(prompt: Prompt): Step {
  const { request, results, system } = readTurn(prompt);
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

  // A11 a A13: rodízio, online e convite de presença.
  if (request.includes("de quem é a vez") || request.includes("de quem e a vez")) {
    const read = find("plantao_rodizio");
    return read ? { kind: "text", text: String(read.value?.message ?? "") } : { kind: "tool", name: "plantao_rodizio", input: {} };
  }
  if (/rod[íi]zio/.test(request) && /autom[áa]tico/.test(request)) {
    const done = find("plantao_rodizio_ordenar");
    return done ? { kind: "text", text: done.value?.ok ? "Pronto." : "Nada mudou." } : { kind: "tool", name: "plantao_rodizio_ordenar", input: { voltar_automatico: true } };
  }
  const first = request.match(/^p[õo]e (?:a |o )?(\S+) primeiro/);
  const online = request.match(/^(?:a |o )?(\S+) vai fazer online/);
  const invite = request.match(/aviso de presen[çc]a (?:pra|para) (?:a |o )?(\S+?)\??$/);
  if (first || online || invite) {
    const who = (first ?? online ?? invite)![1]!;
    const people = find("pessoas_buscar");
    if (!people) return { kind: "tool", name: "pessoas_buscar", input: { texto: who } };
    const personId = ((people.value?.data as { pessoas?: Array<{ id: string }> } | undefined)?.pessoas ?? [])[0]?.id;
    if (!personId) return { kind: "text", text: String(people.value?.message ?? "Não achei essa pessoa.") };
    const tool = first ? "plantao_rodizio_ordenar" : online ? "plantao_modo_online" : "plantao_reenviar_convite";
    const done = find(tool);
    if (done) return { kind: "text", text: done.value?.ok ? "Pronto." : "Nada mudou." };
    const input = first ? { primeiros: [personId] } : online ? { corretor_id: personId, online: true } : { corretor_id: personId };
    return { kind: "tool", name: tool, input };
  }

  // A7 (falta) e A8 (liberar presença): o nome vem em lugares diferentes da frase.
  const absence = request.match(/^(?:a |o )?(\S+) faltou/) ?? request.match(/^tir[ae] a falta d[ao] (\S+?)\??$/);
  const release = request.match(/^libera a presen[çc]a d[ao] (\S+?)(?:,\s*(.+))?$/);
  if (absence || release) {
    const who = (absence ?? release)![1]!;
    const people = find("pessoas_buscar");
    if (!people) return { kind: "tool", name: "pessoas_buscar", input: { texto: who } };
    const personId = ((people.value?.data as { pessoas?: Array<{ id: string }> } | undefined)?.pessoas ?? [])[0]?.id;
    if (!personId) return { kind: "text", text: String(people.value?.message ?? "Não achei essa pessoa.") };
    const tool = absence ? "plantao_marcar_falta" : "plantao_liberar_presenca";
    const done = find(tool);
    if (done) return { kind: "text", text: done.value?.ok ? "Pronto." : "Nada mudou." };
    return absence
      ? { kind: "tool", name: tool, input: { corretor_id: personId, falta: !request.startsWith("tir") } }
      : { kind: "tool", name: tool, input: { corretor_id: personId, ...(release![2] ? { nota: release![2] } : {}) } };
  }

  // A6 e A5: duas pessoas no mesmo pedido.
  const pass = request.match(/cadeira d[ao] (\S+) de (\S+) para (?:a |o )?(.+?)\??$/);
  const swap = request.match(/^troca (?:a |o )?(\S+) de (\S+) com (?:a |o )?(\S+) de (\S+?)\??$/);
  if (pass || swap) {
    const people = results.filter((item) => item.toolName === "pessoas_buscar");
    const schedules = results.filter((item) => item.toolName === "plantao_escala");
    const wanted = pass ? [pass[1]!, pass[3]!] : [swap![1]!, swap![3]!];
    if (people.length < wanted.length) return { kind: "tool", name: "pessoas_buscar", input: { texto: wanted[people.length] } };
    const ids = people.map((item) => ((item.value?.data as { pessoas?: Array<{ id: string }> } | undefined)?.pessoas ?? [])[0]?.id);
    if (ids.some((id) => !id)) return { kind: "text", text: "Não achei uma das pessoas." };
    const days = pass ? [dayAsked(pass[2]!, system)] : [dayAsked(swap![2]!, system), dayAsked(swap![4]!, system)];
    if (days.some((item) => !item)) return { kind: "text", text: "Não entendi o dia." };
    if (schedules.length < days.length) {
      const index = schedules.length;
      return { kind: "tool", name: "plantao_escala", input: { corretor_id: ids[index], de: days[index], ate: days[index] } };
    }
    const firstSeat = (index: number) => ((schedules[index]!.value?.data as { proximas?: Array<{ ocorrencia_id: string }> } | undefined)?.proximas ?? [])[0]?.ocorrencia_id;
    const tool = pass ? "plantao_passar_cadeira" : "plantao_trocar_corretores";
    const done = find(tool);
    if (done) return { kind: "text", text: done.value?.ok ? "Pronto." : "Nada mudou." };
    if (!firstSeat(0) || (swap && !firstSeat(1))) return { kind: "text", text: "Não achei o plantão de uma das pessoas nesse dia." };
    return pass
      ? { kind: "tool", name: tool, input: { de_corretor_id: ids[0], para_corretor_id: ids[1], ocorrencia_id: firstSeat(0) } }
      : { kind: "tool", name: tool, input: { corretor_a_id: ids[0], ocorrencia_a_id: firstSeat(0), corretor_b_id: ids[1], ocorrencia_b_id: firstSeat(1) } };
  }

  const name = personAsked(request);
  const people = find("pessoas_buscar");
  const choices = results.filter((item) => item.toolName === "escolher").map((item) => String((item.value as { id?: string } | null)?.id ?? ""));
  const chosenPerson = choices.find((id) => !id.includes(":"));
  const chosenSeat = choices.find((id) => id.includes(":"));
  if (!people) return name ? { kind: "tool", name: "pessoas_buscar", input: { texto: name } } : { kind: "text", text: "De quem você está falando?" };
  const found = (people.value?.data as { pessoas?: Array<{ id: string; nome: string; unidade: string | null }>; unico?: boolean } | undefined);
  if (!people.value?.ok || !found?.pessoas?.length) return { kind: "text", text: String(people.value?.message ?? "Não achei essa pessoa.") };
  if (!found.unico && !chosenPerson) {
    return { kind: "tool", name: "escolher", input: { pergunta: "Qual delas?", opcoes: found.pessoas.map((person) => ({ id: person.id, rotulo: person.nome, detalhe: person.unidade ?? undefined })) } };
  }
  const personId = chosenPerson ?? found.pessoas[0]!.id;
  const day = dayAsked(request, system);
  const shift = shiftAsked(request);

  // A9 (no plantão) e A10 (geral): pausar ou voltar a receber.
  const pausing = /^(pausa|pause|para)\b/.test(request);
  const resuming = /^(volta|ativa|retoma|despausa)\b/.test(request);
  if (pausing || resuming) {
    const name = request.includes("plantão") || request.includes("plantao") ? "plantao_pausar" : "corretor_pausar";
    const done = find(name);
    if (done) return { kind: "text", text: done.value?.ok ? "Pronto." : "Nada mudou." };
    return name === "plantao_pausar"
      ? { kind: "tool", name, input: { corretor_id: personId, pausado: pausing } }
      : { kind: "tool", name, input: { corretor_ids: [personId], pausado: pausing } };
  }

  // A2: escalar num dia. A3: tirar de um dia. Mais de um plantão no dia vira escolha.
  const oneDay = (key: "ocorrencias" | "proximas") => {
    const schedule = find("plantao_escala");
    return ((schedule?.value?.data as Record<string, Array<{ ocorrencia_id: string; rotulo: string; vagas_livres?: number | null }>> | undefined)?.[key] ?? []);
  };
  if (/^escal[ae]\b/.test(request) && day) {
    if (!find("plantao_escala")) return { kind: "tool", name: "plantao_escala", input: { de: day, ate: day, ...(shift ? { turno: shift } : {}) } };
    const done = find("plantao_escalar_em_vagas");
    if (done) return { kind: "text", text: done.value?.ok ? "Pronto. A pessoa recebe o aviso no app." : String(done.value?.message ?? "Não deu certo.") };
    const open = oneDay("ocorrencias").filter((item) => item.vagas_livres !== 0);
    if (!open.length) return { kind: "text", text: "Não há plantão com vaga nesse dia." };
    const target = chosenSeat ?? (open.length === 1 ? open[0]!.ocorrencia_id : null);
    if (!target) return { kind: "tool", name: "escolher", input: { pergunta: "Em qual plantão?", opcoes: open.slice(0, 8).map((item) => ({ id: item.ocorrencia_id, rotulo: item.rotulo })) } };
    return { kind: "tool", name: "plantao_escalar_em_vagas", input: { corretor_id: personId, ocorrencia_ids: [target] } };
  }
  if (/^tir[ae]\b/.test(request) && day) {
    if (!find("plantao_escala")) return { kind: "tool", name: "plantao_escala", input: { corretor_id: personId, de: day, ate: day, ...(shift ? { turno: shift } : {}) } };
    const removed = find("plantao_tirar_de_vagas");
    if (removed) return { kind: "text", text: removed.value?.ok ? "Pronto." : String(removed.value?.message ?? "") };
    const mine = oneDay("proximas");
    if (!mine.length) return { kind: "text", text: String(find("plantao_escala")?.value?.message ?? "Ela não tem plantão nesse dia.") };
    const target = chosenSeat ?? (mine.length === 1 ? mine[0]!.ocorrencia_id : null);
    if (!target) return { kind: "tool", name: "escolher", input: { pergunta: "De qual plantão?", opcoes: mine.map((item) => ({ id: item.ocorrencia_id, rotulo: item.rotulo })) } };
    return { kind: "tool", name: "plantao_tirar_de_vagas", input: { corretor_id: personId, ocorrencia_ids: [target] } };
  }

  if (request.includes("quantas cadeiras")) {
    if (last?.toolName !== "plantao_escala") return { kind: "tool", name: "plantao_escala", input: { corretor_id: personId, ate: undefined } };
    return { kind: "text", text: String(last.value?.message ?? "") };
  }

  if (request.includes("tire") || request.includes("tira")) {
    const schedule = find("plantao_escala");
    if (!schedule) return { kind: "tool", name: "plantao_escala", input: { corretor_id: personId, ate: lastCalendarDay(system) ?? undefined } };
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
export function scriptedModel(delayMs: number, fail: () => boolean) {
  return new MockLanguageModelV4({
    provider: "laboratorio",
    modelId: "roteiro",
    doStream: async (options) => {
      if (fail()) throw new Error("Modelo fora do ar (simulado).");
      let step = nextLabStep(options.prompt as unknown as Prompt);
      // Como o modelo de verdade: só chama o que foi oferecido (sem a chave da empresa, a escrita não vem).
      const offered = new Set((options.tools ?? []).map((tool) => tool.name));
      if (step.kind === "tool" && !offered.has(step.name)) {
        step = { kind: "text", text: "Achei as vagas, mas as ações do agente ainda não estão liberadas nesta empresa: só consigo consultar." };
      }
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

