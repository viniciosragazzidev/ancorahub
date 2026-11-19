/**
 * Camada de IA dinâmica e limitada da Sasá (19/11): para perguntas que não casam com uma resposta direta
 * ("qual lead devo priorizar?", "como foi minha semana?"), a IA combina as ferramentas de leitura em vários passos.
 * Limites (pedido do usuário): só leitura do próprio corretor, até 4 leituras e 1 resposta, ~15 s no total; ao
 * estourar, devolve o que tem e diz o que faltou. Sem inventar: só afirma o que veio das leituras. Fora do CRM do
 * corretor, recusa com educação. Puro: o modelo (`ask`) e as leituras (`read`) entram por parâmetro.
 */
import { z } from "zod";

import { SASA_AREA_GUIDE, SASA_AREA_LABEL, SASA_AREAS, type SasaArea } from "./ecosystem-areas";

export const SASA_AGENT_MAX_READS = 4;
export const SASA_AGENT_DEADLINE_MS = 15_000;

export const agentStepSchema = z.object({
  action: z.enum(["read", "answer"]),
  area: z.enum(SASA_AREAS).nullish(),
  lead: z.string().trim().max(80).nullish(),
  text: z.string().trim().max(900).nullish(),
});
export type AgentStep = z.infer<typeof agentStepSchema>;
export type AgentMessage = { role: "system" | "user" | "assistant"; content: string };

export const SASA_AGENT_SYSTEM = [
  "Você é a Sasá, assistente do corretor de plano de saúde no CRM AncoraHub. Responda em português do Brasil, em tom de colega, em até 4 frases curtas. Nunca use travessão.",
  "Você só enxerga os dados do próprio corretor, lidos pelas ferramentas abaixo. Use somente o que veio em RESULTADO. Se faltar dado, diga que não sabe; se a ferramenta disser que não há acesso, diga que ele não tem acesso. Nunca invente número, nome ou data.",
  "Nunca informe preço, carência ou cobertura de plano, e nunca prometa nada em nome da empresa.",
  "Se a pergunta não for sobre o trabalho do corretor no CRM, recuse com educação e diga o que você consegue fazer (leads, carteira, plantões, agenda, desempenho, comissões, vendas, cotações, avisos).",
  `Ferramentas (leitura, uma por vez, no máximo ${SASA_AGENT_MAX_READS}):`,
  ...SASA_AREAS.map((area) => `- ${area}: ${SASA_AREA_GUIDE[area]}${area === "lead" ? ' (passe o nome em "lead")' : ""}`),
  'Responda APENAS um JSON por vez: {"action":"read","area":"<ferramenta>","lead"?:"<nome>"} para ler, ou {"action":"answer","text":"<resposta>"} para responder.',
].join("\n");

export type AgentResult = { text: string; reads: SasaArea[]; truncated: boolean; reason?: "reads" | "time" | "model" };

/** O que foi lido, para a resposta de reserva quando o tempo acaba. */
function partial(results: Array<{ area: SasaArea; text: string }>, reason: "reads" | "time" | "model"): AgentResult {
  if (!results.length) return { text: "Não consegui responder agora. Tente perguntar de outro jeito ou mais curto.", reads: [], truncated: true, reason };
  const seen = results.map((result) => result.text).join(" ");
  const why = reason === "time" ? "o tempo da resposta acabou" : reason === "reads" ? `cheguei ao limite de ${SASA_AGENT_MAX_READS} consultas` : "não consegui concluir a análise";
  return { text: `Respondo com o que consegui ver (${why}): ${seen}`.slice(0, 900), reads: results.map((result) => result.area), truncated: true, reason };
}

export async function runSasaAgentLoop(input: {
  question: string;
  /** Áreas que as palavras da pergunta sugerem (só uma dica para o modelo). */
  hint?: SasaArea[];
  ask: (messages: AgentMessage[], remainingMs: number) => Promise<AgentStep | null>;
  read: (area: SasaArea, lead: string | null) => Promise<string>;
  clock?: () => number;
  maxReads?: number;
  deadlineMs?: number;
}): Promise<AgentResult> {
  const clock = input.clock ?? Date.now;
  const maxReads = input.maxReads ?? SASA_AGENT_MAX_READS;
  const deadline = clock() + (input.deadlineMs ?? SASA_AGENT_DEADLINE_MS);
  const results: Array<{ area: SasaArea; key: string; text: string }> = [];
  const messages: AgentMessage[] = [
    { role: "system", content: SASA_AGENT_SYSTEM },
    { role: "user", content: `PERGUNTA DO CORRETOR: ${input.question}${input.hint?.length ? `\nDica: talvez ajude ler ${input.hint.map((area) => `${area} (${SASA_AREA_LABEL[area]})`).join(", ")}.` : ""}` },
  ];

  // Até `maxReads` leituras e mais uma chamada para responder.
  for (let turn = 0; turn <= maxReads; turn += 1) {
    const remaining = deadline - clock();
    if (remaining <= 0) return partial(results, "time");
    const finalTurn = results.length >= maxReads;
    if (finalTurn) messages.push({ role: "user", content: "Limite de consultas atingido. Responda agora só com o que já leu e diga o que faltou." });
    const step = await input.ask(messages, remaining).catch(() => null);
    if (!step) return partial(results, "model");
    if (step.action === "answer" && step.text) {
      return { text: step.text, reads: results.map((result) => result.area), truncated: finalTurn, ...(finalTurn ? { reason: "reads" as const } : {}) };
    }
    if (finalTurn) return partial(results, "reads");
    if (step.action !== "read" || !step.area) return partial(results, "model");
    const key = `${step.area}:${(step.lead ?? "").toLowerCase()}`;
    messages.push({ role: "assistant", content: JSON.stringify({ action: "read", area: step.area, ...(step.lead ? { lead: step.lead } : {}) }) });
    const done = results.find((result) => result.key === key);
    if (done) {
      messages.push({ role: "user", content: `Você já leu ${step.area}. Use o resultado anterior ou responda.` });
      continue;
    }
    const text = await input.read(step.area, step.lead ?? null).catch(() => "Não consegui ler esses dados agora.");
    results.push({ area: step.area, key, text });
    messages.push({ role: "user", content: `RESULTADO ${step.area}: ${text}` });
  }
  return partial(results, "reads");
}
