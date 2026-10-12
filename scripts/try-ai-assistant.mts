// Manual check (no DB): sends a realistic assistant prompt to the Groq models and validates the reply schema.
//   npx tsx scripts/try-ai-assistant.mts
import fs from "node:fs";

import { AGENT_REGISTRY, assistantReplySchema, buildMessages } from "../src/features/ai-gateway/agents";

const env = fs.readFileSync(".env.local", "utf8");
const key = env.match(/^GROQ_API_KEY="?([^"\n]*)"?/m)?.[1]?.trim();
if (!key) throw new Error("GROQ_API_KEY não encontrado no .env.local.");
const context = "Corretor: Ana. Unidade: Centro. Disponibilidade: online.\nHoje: 5 recebidos, 3 aceitos, 2 em atendimento, 1 com primeiro contato atrasando, 2 retornos, 1 esperando resposta.\nLeads: Maria S. [em_atendimento, respondeu]; João P. [novo, first_contact]; Carla M. [cotacao]";
for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
  const startedAt = Date.now();
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: buildMessages(AGENT_REGISTRY.leads, context, "Maria Souza"), temperature: 0.3, max_tokens: 450, response_format: { type: "json_object" }, reasoning_effort: "low" }),
  });
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content ?? "";
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { /* invalid */ }
  const check = assistantReplySchema.safeParse(parsed);
  console.log(model, response.status, `${Date.now() - startedAt}ms`, check.success ? "SCHEMA OK" : "SCHEMA FALHOU", text.slice(0, 300));
}
