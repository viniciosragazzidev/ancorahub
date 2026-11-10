/**
 * Regras puras do roteiro guiado de presença (09/11): qual etapa mostrar, qual erro, o progresso e a retomada.
 * O servidor é a verdade (conexão e presença); o navegador só lembra o detalhe (etapa e tipo de celular).
 */
export type GuideStep = "boasvindas" | "numero" | "codigo" | "telainicial" | "caminho" | "esperando" | "conectado" | "confirmar" | "pronto";
export type GuideDevice = "mobile" | "desktop";
/** "presence": conectar e confirmar presença (cartão do plantão). "connect": só conectar (botão do WhatsApp no topo). */
export type GuideMode = "presence" | "connect";
export type GuidePlatform = "android" | "iphone";
/** Onde a presença está depois de conectar: o cartão de presença decide e o roteiro só mostra. */
export type ConfirmStage = "connect" | "confirm" | "sending" | "done" | "waiting" | "error";
export type GuideError = "expired" | "cooldown" | "issue" | "rejected" | "stalled" | "notOpened" | "copyBlocked" | "unstable" | "confirm";
/** Erros que só o navegador percebe (o app não abriu, a cópia foi bloqueada). */
export type LocalIssue = "notOpened" | "copyBlocked" | "codeTimeout";

export type GuideConnectionFacts = {
  ready: boolean;
  phase: "idle" | "starting" | "qr" | "pairing" | "ready" | "error";
  code: string | null;
  expired: boolean;
  cooldownSeconds: number;
  stalled: boolean;
  connectivity: "unreachable" | "unauthorized" | null;
  issue: string | null;
};

const CONNECT_STEPS: GuideStep[] = ["codigo", "telainicial", "caminho", "esperando"];

/** A etapa que aparece: depois de conectar, quem manda é a presença; no computador, código, tela inicial, caminho e espera são uma tela só. */
export function visibleStep(input: { local: GuideStep; device: GuideDevice; ready: boolean; stage: ConfirmStage }): GuideStep {
  if (input.stage === "done" || input.stage === "waiting") return "pronto";
  if (input.stage === "confirm" || input.stage === "sending" || input.stage === "error") return "confirmar";
  if (input.ready) return "conectado";
  if (input.device === "desktop" && CONNECT_STEPS.includes(input.local)) return "codigo";
  return input.local;
}

export function guideError(input: { step: GuideStep; device: GuideDevice; facts: GuideConnectionFacts; local: LocalIssue | null; stage: ConfirmStage }): GuideError | null {
  const { step, facts } = input;
  if (step === "confirmar") return input.stage === "error" ? "confirm" : null;
  if (!CONNECT_STEPS.includes(step)) return null;
  if (input.local === "copyBlocked" && step === "codigo") return "copyBlocked";
  // O código não chegou mesmo pedindo de novo (10/11): em vez de quadradinhos vazios para sempre, "Tentar de novo".
  if (input.local === "codeTimeout" && step === "codigo" && !facts.code) return "issue";
  if (input.local === "notOpened" && (step === "telainicial" || step === "caminho" || step === "esperando")) return "notOpened";
  if (facts.connectivity) return "unstable";
  if (facts.expired && !facts.code) return "expired";
  if (!facts.code && facts.cooldownSeconds > 0) return "cooldown";
  if (!facts.code && facts.issue) return "issue";
  if (facts.phase === "error" && (step === "esperando" || input.device === "desktop")) return "rejected";
  if (facts.stalled && (step === "esperando" || input.device === "desktop")) return "stalled";
  return null;
}

/**
 * Marcos da barra: 7 no celular, 4 no computador. A última etapa enche a barra.
 * Só conectar (botão do WhatsApp no topo, 10/11): sem a presença, termina em "conectado" (6 e 3 marcos).
 */
export function progressOf(step: GuideStep, device: GuideDevice, mode: GuideMode = "presence"): { at: number; total: number; fill: number } {
  const marks: Partial<Record<GuideStep, number>> = device === "desktop"
    ? { boasvindas: 1, numero: 1, codigo: 2, telainicial: 2, caminho: 2, esperando: 2, conectado: 3, confirmar: 4, pronto: 4 }
    : { boasvindas: 1, numero: 1, codigo: 2, telainicial: 3, caminho: 4, esperando: 5, conectado: 6, confirmar: 7, pronto: 7 };
  const last: GuideStep = mode === "connect" ? "conectado" : "pronto";
  const total = (device === "desktop" ? 4 : 7) - (mode === "connect" ? 1 : 0);
  const at = Math.min(marks[step] ?? 1, total);
  return { at, total, fill: step === last ? 1 : (at - 0.5) / total };
}

// ── Retomada ──────────────────────────────────────────────────────────

export const GUIDE_STORAGE_PREFIX = "ancora:presenca-guia:";
/** Depois disto a lembrança não vale mais (o plantão já mudou de fase). */
export const GUIDE_MEMORY_MS = 2 * 60 * 60_000;

export type GuideMemory = { step: GuideStep; platform: GuidePlatform; at: number };

/** Onde recomeçar. Antes de conectar, o código antigo não vale: quem já passou do código recomeça nele, com um novo. */
export function resumeStep(memory: GuideMemory | null, now: number): GuideStep | null {
  if (!memory || now - memory.at > GUIDE_MEMORY_MS) return null;
  if (memory.step === "boasvindas" || memory.step === "conectado" || memory.step === "confirmar" || memory.step === "pronto") return null;
  return memory.step === "numero" ? "numero" : "codigo";
}

export function readGuideMemory(key: string): GuideMemory | null {
  try {
    const raw = window.localStorage.getItem(GUIDE_STORAGE_PREFIX + key);
    if (!raw) return null;
    const value = JSON.parse(raw) as GuideMemory;
    return value && typeof value.step === "string" && typeof value.at === "number" ? value : null;
  } catch {
    return null;
  }
}

export function writeGuideMemory(key: string, memory: GuideMemory | null) {
  try {
    if (memory) window.localStorage.setItem(GUIDE_STORAGE_PREFIX + key, JSON.stringify(memory));
    else window.localStorage.removeItem(GUIDE_STORAGE_PREFIX + key);
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): o roteiro recomeça do começo, sem quebrar.
  }
}

export function platformFromUserAgent(userAgent: string): GuidePlatform {
  return /iphone|ipad|ipod/i.test(userAgent) ? "iphone" : "android";
}

// ── Narração por etapa (10/11) ────────────────────────────────────────

/** Um áudio curto (até ~10 s) por etapa; os textos estão em PRESENCE_GUIDE_NARRATION (pairing-copy.ts). */
export type NarrationKey =
  | "boas-vindas" | "numero" | "codigo" | "codigo-computador-qr" | "codigo-computador-numero" | "tela-inicial"
  | "toque-1-android" | "toque-1-iphone" | "toque-2" | "toque-3" | "toque-4" | "esperando"
  | "conectado" | "conectado-so-conectar" | "confirmar" | "confirmar-presencial" | "pronto" | "pronto-presencial";

/** Qual narração toca agora. Com erro na tela não há narração (o texto do erro já diz o que fazer). */
export function narrationKey(input: {
  step: GuideStep; scene: number; platform: GuidePlatform; device: GuideDevice; mode: GuideMode;
  method: "qr" | "code"; dutyMode: "online" | "presencial"; stage: ConfirmStage; error: GuideError | null;
}): NarrationKey | null {
  if (input.error) return null;
  switch (input.step) {
    case "boasvindas": return "boas-vindas";
    case "numero": return "numero";
    case "codigo":
      if (input.device === "desktop") return input.method === "qr" ? "codigo-computador-qr" : "codigo-computador-numero";
      return "codigo";
    case "telainicial": return "tela-inicial";
    case "caminho":
      if (input.scene <= 0) return input.platform === "iphone" ? "toque-1-iphone" : "toque-1-android";
      return input.scene === 1 ? "toque-2" : input.scene === 2 ? "toque-3" : "toque-4";
    case "esperando": return "esperando";
    case "conectado": return input.mode === "connect" ? "conectado-so-conectar" : "conectado";
    case "confirmar": return input.stage === "sending" ? null : input.dutyMode === "presencial" ? "confirmar-presencial" : "confirmar";
    case "pronto": return input.stage === "waiting" ? "pronto-presencial" : "pronto";
    default: return null;
  }
}
