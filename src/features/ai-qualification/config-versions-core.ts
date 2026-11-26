/**
 * Histórico do "Prompt e comportamento", regras puras (26/11/2026, engenharia reversa §7.3).
 * Cada salvar vira uma versão com os campos editáveis; restaurar cria uma versão nova igual à antiga.
 * O interruptor "IA operando" não entra: restaurar nunca liga nem pausa a IA.
 */

export const CONFIG_VERSION_FIELDS = [
  "pauseMode",
  "assistantName",
  "initialMessage",
  "handoffMessage",
  "outOfHoursMessage",
  "absenceMessage",
  "tone",
  "useEmojis",
  "timeoutMinutes",
  "businessContext",
  "customInstructions",
  "quickReplyCooldownMinutes",
  "quickReplyWaitWindowMinutes",
  "quickReplyWaitLimitCount",
] as const;

export type ConfigVersionField = (typeof CONFIG_VERSION_FIELDS)[number];
export type ConfigSnapshot = Partial<Record<ConfigVersionField, string | number | boolean | null>>;

const FIELD_LABEL: Record<ConfigVersionField, string> = {
  pauseMode: "modo de pausa",
  assistantName: "nome de exibição",
  initialMessage: "mensagem inicial",
  handoffMessage: "mensagem de transferência",
  outOfHoursMessage: "mensagem fora do horário",
  absenceMessage: "mensagem de ausência",
  tone: "tom de voz",
  useEmojis: "emojis",
  timeoutMinutes: "tempo limite",
  businessContext: "base de conhecimento",
  customInstructions: "diretrizes",
  quickReplyCooldownMinutes: "respostas rápidas",
  quickReplyWaitWindowMinutes: "respostas rápidas",
  quickReplyWaitLimitCount: "respostas rápidas",
};

function normalizeValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

/** Só os campos editáveis, normalizados (texto aparado, vazio vira ""). */
export function configSnapshotOf(source: Record<string, unknown> | null | undefined): ConfigSnapshot {
  const snapshot: ConfigSnapshot = {};
  for (const field of CONFIG_VERSION_FIELDS) snapshot[field] = normalizeValue(source?.[field]);
  return snapshot;
}

/** Campos que mudaram de uma versão para outra (texto vazio e ausente contam como iguais). */
export function changedConfigFields(previous: ConfigSnapshot | null, next: ConfigSnapshot): ConfigVersionField[] {
  if (!previous) return [];
  const same = (a: unknown, b: unknown) => (a ?? "") === (b ?? "");
  return CONFIG_VERSION_FIELDS.filter((field) => !same(previous[field], next[field]));
}

function joinPt(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** O que mudou, em uma linha ("Mudou nome de exibição e diretrizes"). */
export function summarizeConfigChange(input: { changed: readonly string[]; restoredFromVersion?: number | null; first?: boolean }) {
  if (input.restoredFromVersion) return `Restaurou a versão ${input.restoredFromVersion}`;
  if (input.first) return "Versão de partida";
  const labels = [...new Set(input.changed.map((field) => FIELD_LABEL[field as ConfigVersionField]).filter(Boolean))];
  if (!labels.length) return "Salvou sem mudar os textos";
  if (labels.length > 3) return `Mudou ${joinPt(labels.slice(0, 3))} e mais ${labels.length - 3}`;
  return `Mudou ${joinPt(labels)}`;
}

/**
 * Entrada do salvar a partir de uma versão antiga: os campos guardados valem, o resto (e o interruptor da IA) fica
 * como está agora.
 */
export function restoreInputFrom<T extends Record<string, unknown>>(snapshot: ConfigSnapshot, current: T): T {
  const next: Record<string, unknown> = { ...current };
  for (const field of CONFIG_VERSION_FIELDS) {
    const value = snapshot[field];
    if (value !== undefined && value !== null) next[field] = value;
  }
  return next as T;
}

/** Lê o jsonb do banco sem confiar no formato. */
export function parseConfigSnapshot(raw: unknown): ConfigSnapshot {
  return raw && typeof raw === "object" ? configSnapshotOf(raw as Record<string, unknown>) : {};
}
