import { createRateLimiter } from "@/shared/http/rate-limit";

/**
 * Guards for the signed-in chat routes that call a paid model with messages
 * sent by the browser:
 * - a client message can never act as a system prompt (it would replace the
 *   CRM rules the model must follow);
 * - bounded size and count, so one request cannot run up the bill;
 * - a per-user rate limit (each call is a paid model call).
 */
export const CHAT_LIMITS = {
  maxMessages: 60,
  maxBodyChars: 120_000,
  perUserMinute: { requests: 20, windowMs: 60_000 },
} as const;

const allowChat = createRateLimiter(CHAT_LIMITS.perUserMinute);

export type ChatGuardResult =
  | { ok: true; messages: unknown[] }
  | { ok: false; status: 400 | 413 | 429; error: string; retryAfterSeconds?: number };

export function checkChatRequest(input: { userId: string; tenantId: string; body: unknown; rawLength: number }, now = Date.now()): ChatGuardResult {
  if (input.rawLength > CHAT_LIMITS.maxBodyChars) return { ok: false, status: 413, error: "Conversa longa demais. Comece uma nova." };
  const messages = (input.body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false, status: 400, error: "Mensagens inválidas." };
  if (messages.length > CHAT_LIMITS.maxMessages) return { ok: false, status: 413, error: "Conversa longa demais. Comece uma nova." };
  const hasSystem = messages.some((message) => (message as { role?: unknown } | null)?.role === "system");
  if (hasSystem) return { ok: false, status: 400, error: "Mensagens inválidas." };
  const limited = allowChat(`${input.tenantId}:${input.userId}`, now);
  if (!limited.ok) return { ok: false, status: 429, error: "Muitas perguntas seguidas. Tente de novo em instantes.", retryAfterSeconds: limited.retryAfterSeconds };
  return { ok: true, messages };
}

export async function readChatRequest(req: Request, context: { userId: string; tenantId: string }) {
  const raw = await req.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false as const, status: 400 as const, error: "Mensagens inválidas." };
  }
  return checkChatRequest({ ...context, body, rawLength: raw.length });
}
