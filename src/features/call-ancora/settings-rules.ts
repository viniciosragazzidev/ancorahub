import { z } from "zod";

/**
 * Configurações do Call Âncora por empresa (tela do diretor). Guardadas em system_settings,
 * sem tabela nova. Valores fora da faixa são recusados.
 */
export const callAncoraSettingsSchema = z.object({
  /** Contatos por corretor por dia (cada ligação classificada conta um). */
  dailyContactsPerBroker: z.number().int().min(1).max(1000),
  /** Créditos diários da empresa: total de contatos por dia somando todos os corretores. 0 = sem limite. */
  tenantDailyCredits: z.number().int().min(0).max(100_000),
  /** Período dos leads: só frios criados entre X dias atrás (mais antigo) e Y dias atrás (mais novo). */
  leadPeriodMaxAgeDays: z.number().int().min(1).max(3650),
  leadPeriodMinAgeDays: z.number().int().min(0).max(3650),
  /** Tentativas por lead e intervalo mínimo entre elas. */
  maxAttemptsPerLead: z.number().int().min(1).max(10),
  attemptCooldownHours: z.number().int().min(1).max(168),
  /** Janela de ligações (horário de São Paulo). */
  windowStartHour: z.number().int().min(0).max(23),
  windowEndHour: z.number().int().min(1).max(24),
  saturdayEnabled: z.boolean(),
  /** Discagem automática já ligada ao iniciar a sessão. */
  autoDialByDefault: z.boolean(),
}).refine((value) => value.leadPeriodMinAgeDays < value.leadPeriodMaxAgeDays, {
  message: "O período dos leads precisa ter o início mais antigo que o fim.",
  path: ["leadPeriodMinAgeDays"],
}).refine((value) => value.windowStartHour < value.windowEndHour, {
  message: "O horário de início precisa ser antes do fim.",
  path: ["windowStartHour"],
});

export type CallAncoraSettings = z.infer<typeof callAncoraSettingsSchema>;

export const CALL_ANCORA_DEFAULT_SETTINGS: CallAncoraSettings = {
  dailyContactsPerBroker: 120,
  tenantDailyCredits: 0,
  leadPeriodMaxAgeDays: 365,
  leadPeriodMinAgeDays: 0,
  maxAttemptsPerLead: 3,
  attemptCooldownHours: 4,
  windowStartHour: 8,
  windowEndHour: 20,
  saturdayEnabled: true,
  autoDialByDefault: false,
};

/** Lê o JSON guardado; o que estiver faltando ou inválido volta ao padrão. */
export function parseCallAncoraSettings(raw: string | null | undefined): CallAncoraSettings {
  if (!raw) return { ...CALL_ANCORA_DEFAULT_SETTINGS };
  try {
    const merged = { ...CALL_ANCORA_DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<CallAncoraSettings>) };
    const parsed = callAncoraSettingsSchema.safeParse(merged);
    return parsed.success ? parsed.data : { ...CALL_ANCORA_DEFAULT_SETTINGS };
  } catch {
    return { ...CALL_ANCORA_DEFAULT_SETTINGS };
  }
}

/** Janela de ligações pelas configurações (domingo nunca; sábado se ligado). */
export function isWindowOpenFor(settings: CallAncoraSettings, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (weekday === "Sun") return false;
  if (weekday === "Sat" && !settings.saturdayEnabled) return false;
  return hour >= settings.windowStartHour && hour < settings.windowEndHour;
}

export function windowMessage(settings: CallAncoraSettings) {
  const days = settings.saturdayEnabled ? "segunda a sábado" : "segunda a sexta";
  return `Fora do horário de ligações (${days}, ${settings.windowStartHour}h às ${settings.windowEndHour}h).`;
}

/** Início do dia de hoje em São Paulo (para contar o uso diário). */
export function startOfTodaySaoPaulo(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${day}T00:00:00-03:00`);
}
