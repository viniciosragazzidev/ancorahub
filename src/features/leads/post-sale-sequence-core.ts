/**
 * Sequência de pós-venda (planos de tarefa do DeskComm, versão pequena): quando o lead vira Convertido, o corretor
 * dono ganha três tarefas, "Boas-vindas ao cliente" em D+1, "Confirmar implantação e carteirinha" em D+15 e
 * "Pesquisa de satisfação" em D+30, sempre às 9h em São Paulo (domingo vira segunda). O diretor liga, desliga e
 * ajusta dias e títulos em Configurações. Tudo aqui é puro: o servidor só lê a configuração e grava as tarefas.
 *
 * Idempotência: o id de cada tarefa sai do lead e do passo (`pos-venda:<lead>:<passo>`). Se o lead sair de
 * Convertido e voltar, ou a venda for registrada depois da IA converter, nada se repete.
 */
import { computeTaskPresetDue } from "./task-presets";

export const POST_SALE_SEQUENCE_STEP_IDS = ["boas-vindas", "implantacao", "satisfacao"] as const;
export type PostSaleSequenceStepId = (typeof POST_SALE_SEQUENCE_STEP_IDS)[number];

export type PostSaleSequenceStep = { id: PostSaleSequenceStepId; days: number; title: string };
export type PostSaleSequenceSettings = { enabled: boolean; steps: PostSaleSequenceStep[] };

export const POST_SALE_SEQUENCE_HOUR = 9;
export const MIN_POST_SALE_SEQUENCE_DAYS = 1;
export const MAX_POST_SALE_SEQUENCE_DAYS = 365;
export const MIN_POST_SALE_SEQUENCE_TITLE = 2;
export const MAX_POST_SALE_SEQUENCE_TITLE = 120;

export const DEFAULT_POST_SALE_SEQUENCE: PostSaleSequenceSettings = {
  enabled: true,
  steps: [
    { id: "boas-vindas", days: 1, title: "Boas-vindas ao cliente" },
    { id: "implantacao", days: 15, title: "Confirmar implantação e carteirinha" },
    { id: "satisfacao", days: 30, title: "Pesquisa de satisfação" },
  ],
};

/** Chave por empresa em system_settings (mesmo padrão de `proposals_default_valid_days_<tenant>`). */
export function postSaleSequenceSettingKey(tenantId: string) {
  return `post_sale_sequence_${tenantId}`;
}

/** Prefixo dos ids das tarefas da sequência de um lead. */
export function postSaleSequenceTaskPrefix(leadId: string) {
  return `pos-venda:${leadId}:`;
}

export function postSaleSequenceTaskId(leadId: string, stepId: PostSaleSequenceStepId) {
  return `${postSaleSequenceTaskPrefix(leadId)}${stepId}`;
}

/** Dias válidos (inteiro de 1 a 365) ou null. */
export function parsePostSaleSequenceDays(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,3}$/.test(text)) return null;
  const days = Number(text);
  return days >= MIN_POST_SALE_SEQUENCE_DAYS && days <= MAX_POST_SALE_SEQUENCE_DAYS ? days : null;
}

/** Título limpo (espaços juntados) com 2 a 120 caracteres, ou null. */
export function parsePostSaleSequenceTitle(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  return text.length >= MIN_POST_SALE_SEQUENCE_TITLE && text.length <= MAX_POST_SALE_SEQUENCE_TITLE ? text : null;
}

/** Lê o JSON salvo; o que faltar ou vier inválido volta ao padrão (ligado, com os 3 passos). */
export function resolvePostSaleSequenceSettings(stored: string | null | undefined): PostSaleSequenceSettings {
  let parsed: unknown = null;
  try {
    parsed = stored ? JSON.parse(stored) : null;
  } catch {
    parsed = null;
  }
  const record = parsed && typeof parsed === "object" ? parsed as { enabled?: unknown; steps?: unknown } : {};
  const storedSteps = Array.isArray(record.steps) ? record.steps as Array<{ id?: unknown; days?: unknown; title?: unknown }> : [];
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_POST_SALE_SEQUENCE.enabled,
    steps: DEFAULT_POST_SALE_SEQUENCE.steps.map((fallback) => {
      const saved = storedSteps.find((step) => step?.id === fallback.id);
      return {
        id: fallback.id,
        days: parsePostSaleSequenceDays(saved?.days) ?? fallback.days,
        title: parsePostSaleSequenceTitle(saved?.title) ?? fallback.title,
      };
    }),
  };
}

export type PostSaleSequenceInput = { enabled: unknown; steps: Array<{ id: string; days: unknown; title: unknown }> };

/** Valida o que o diretor mandou. Devolve a configuração pronta para salvar ou o primeiro erro, em texto. */
export function validatePostSaleSequenceInput(input: PostSaleSequenceInput): { ok: true; settings: PostSaleSequenceSettings } | { ok: false; error: string } {
  const steps: PostSaleSequenceStep[] = [];
  for (const [index, fallback] of DEFAULT_POST_SALE_SEQUENCE.steps.entries()) {
    const raw = input.steps.find((step) => step.id === fallback.id);
    const days = parsePostSaleSequenceDays(raw?.days);
    if (days === null) return { ok: false, error: `Passo ${index + 1}: informe de ${MIN_POST_SALE_SEQUENCE_DAYS} a ${MAX_POST_SALE_SEQUENCE_DAYS} dias.` };
    const title = parsePostSaleSequenceTitle(raw?.title);
    if (title === null) return { ok: false, error: `Passo ${index + 1}: o título precisa ter de ${MIN_POST_SALE_SEQUENCE_TITLE} a ${MAX_POST_SALE_SEQUENCE_TITLE} caracteres.` };
    steps.push({ id: fallback.id, days, title });
  }
  return { ok: true, settings: { enabled: input.enabled === true || input.enabled === "on" || input.enabled === "true", steps } };
}

export function serializePostSaleSequenceSettings(settings: PostSaleSequenceSettings) {
  return JSON.stringify({ enabled: settings.enabled, steps: settings.steps.map(({ id, days, title }) => ({ id, days, title })) });
}

/** Prazo de um passo: `days` depois da conversão, às 9h de São Paulo; domingo vai para segunda. */
export function postSaleSequenceDueAt(days: number, convertedAt: Date): Date {
  return computeTaskPresetDue({ id: "pos-venda", label: "", title: "", days, hour: POST_SALE_SEQUENCE_HOUR }, convertedAt);
}

export type PostSaleSequenceTask = { id: string; stepId: PostSaleSequenceStepId; title: string; dueAt: Date };

export type PostSaleSequenceSkipReason = "desligada" | "sem_corretor" | "nao_convertido" | "ja_criada";

export type PostSaleSequencePlan =
  | { kind: "create"; tasks: PostSaleSequenceTask[] }
  | { kind: "skip"; reason: PostSaleSequenceSkipReason };

/**
 * O que criar para um lead que acabou de virar venda. `existingTaskIds` são os ids de tarefa da sequência que o lead
 * já tem: com qualquer um deles, a sequência já começou e não se repete (nem os passos que o corretor apagou).
 */
export function planPostSaleSequence(input: {
  settings: PostSaleSequenceSettings;
  lead: { id: string; status: string; corretorId: string | null };
  existingTaskIds: readonly string[];
  convertedAt: Date;
}): PostSaleSequencePlan {
  if (!input.settings.enabled) return { kind: "skip", reason: "desligada" };
  if (input.lead.status !== "converted") return { kind: "skip", reason: "nao_convertido" };
  if (!input.lead.corretorId) return { kind: "skip", reason: "sem_corretor" };
  const prefix = postSaleSequenceTaskPrefix(input.lead.id);
  if (input.existingTaskIds.some((id) => id.startsWith(prefix))) return { kind: "skip", reason: "ja_criada" };
  return {
    kind: "create",
    tasks: input.settings.steps.map((step) => ({
      id: postSaleSequenceTaskId(input.lead.id, step.id),
      stepId: step.id,
      title: step.title,
      dueAt: postSaleSequenceDueAt(step.days, input.convertedAt),
    })),
  };
}

export const POST_SALE_SEQUENCE_SKIP_LABELS: Record<PostSaleSequenceSkipReason, string> = {
  desligada: "Sequência de pós-venda desligada nas configurações.",
  sem_corretor: "Lead sem corretor dono.",
  nao_convertido: "Lead não está mais Convertido.",
  ja_criada: "Sequência já criada para este lead.",
};
