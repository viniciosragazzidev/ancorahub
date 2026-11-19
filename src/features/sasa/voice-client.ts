import type { ChatBlock, ChatServerActionName } from "@/components/chat/types";
import type { VoiceTranscribe } from "@/components/chat/voice-recorder";

/** Envia a nota de voz para `/api/sasa/voz` e devolve o texto (o áudio não fica guardado no servidor). */
export const transcribeSasaVoice: VoiceTranscribe = async ({ audio, seconds, clientCommandId }) => {
  const form = new FormData();
  const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.set("audio", audio, `sasa.${extension}`);
  form.set("clientCommandId", clientCommandId);
  form.set("seconds", seconds.toFixed(1));
  const response = await fetch("/api/sasa/voz", { method: "POST", body: form });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; text?: string; error?: string } | null;
  if (data?.ok && data.text) return { ok: true, text: data.text };
  return { ok: false, error: data?.error ?? "Não consegui entender o áudio. Tente de novo ou escreva." };
};

/** "Corrigir o que eu ouvi": desfaz o que foi feito (se houver) e devolve o texto ao campo. */
export const SASA_FIX_PREFIX = "sasa-fix:";
type UndoAction = { name: ChatServerActionName; payload: Record<string, string | number | boolean | null> };

export function undoOf(blocks: ChatBlock[]): UndoAction | null {
  for (const block of blocks) {
    if (block.type !== "question") continue;
    const choice = block.choices.find((item) => item.id === "undo" && item.action.kind === "server");
    if (choice?.action.kind === "server") return { name: choice.action.name, payload: choice.action.payload };
  }
  return null;
}

export function sasaFixBlock(text: string, blocks: ChatBlock[], stamp: string): ChatBlock {
  return {
    type: "question",
    id: `sasa-fix-${stamp}`,
    prompt: "Entendi certo?",
    choices: [{ id: "fix", label: "Corrigir o que eu ouvi", reply: "Corrigir", action: { kind: "local", value: `${SASA_FIX_PREFIX}${JSON.stringify({ t: text, u: undoOf(blocks) })}` } }],
  };
}

export function readSasaFix(value: string): { text: string; undo: UndoAction | null } | null {
  if (!value.startsWith(SASA_FIX_PREFIX)) return null;
  try {
    const data = JSON.parse(value.slice(SASA_FIX_PREFIX.length)) as { t?: unknown; u?: UndoAction | null };
    return typeof data.t === "string" ? { text: data.t.slice(0, 500), undo: data.u && typeof data.u.name === "string" ? data.u : null } : null;
  } catch {
    return null;
  }
}
