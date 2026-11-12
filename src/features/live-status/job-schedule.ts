/**
 * Espelho da tabela de `docs/runbooks/coolify-scheduled-tasks.md` (status vivos, 27/10): o caminho e o cron de cada
 * robô. É daqui que sai "próxima rodada em 00:01:20". Mudou o runbook, muda aqui (o teste confere as chaves).
 * O Coolify agenda em UTC; os passos de minuto não dependem do fuso, e o resumo das 19h (22:00 UTC) já está em UTC.
 */
export const JOB_SCHEDULE = {
  whatsapp: { path: "/api/internal/jobs/whatsapp", cron: "* * * * *", label: "Envio do WhatsApp" },
  distribution: { path: "/api/internal/jobs/distribution", cron: "*/2 * * * *", label: "Distribuição de leads" },
  "distribution-priority": { path: "/api/internal/jobs/distribution-priority", cron: "* * * * *", label: "Distribuição de quentes e mornos" },
  "qualification-timeout": { path: "/api/internal/jobs/qualification-timeout", cron: "*/2 * * * *", label: "Tempo limite da qualificação" },
  "waha-sync": { path: "/api/internal/jobs/waha-sync", cron: "* * * * *", label: "Mensagens dos corretores" },
  "lead-effects": { path: "/api/internal/jobs/lead-effects", cron: "* * * * *", label: "Efeitos pós-entrada" },
  purge: { path: "/api/internal/jobs/purge", cron: "* * * * *", label: "Expurgo agendado" },
  sla: { path: "/api/internal/sla", cron: "*/5 * * * *", label: "Prazo de primeiro contato" },
  reminders: { path: "/api/internal/reminders", cron: "*/5 * * * *", label: "Lembretes" },
  "meta-conversions": { path: "/api/internal/jobs/meta-conversions", cron: "*/5 * * * *", label: "Conversões para a Meta" },
  "meta-sync": { path: "/api/internal/jobs/meta-sync", cron: "0 * * * *", label: "Sincronização com a Meta" },
  "qualification-cadence": { path: "/api/internal/jobs/qualification-cadence", cron: "*/2 * * * *", label: "Régua de lembretes" },
  "conversation-intelligence": { path: "/api/internal/jobs/conversation-intelligence", cron: "* * * * *", label: "Etapa automática" },
  "situation-learning": { path: "/api/internal/jobs/situation-learning", cron: "*/30 * * * *", label: "Aprendizado de situações" },
  "waha-cadence": { path: "/api/internal/jobs/waha-cadence", cron: "*/5 * * * *", label: "Cadências WAHA" },
  engagement: { path: "/api/internal/jobs/engagement", cron: "*/2 * * * *", label: "Jornada do corretor" },
  "supervisor-digest": { path: "/api/internal/jobs/supervisor-digest", cron: "0 22 * * *", label: "Resumo das 19h" },
  "operator-catalog": { path: "/api/internal/jobs/operator-catalog", cron: "*/5 * * * *", label: "Catálogo das operadoras" },
  "customer-waiting": { path: "/api/internal/jobs/customer-waiting", cron: "*/5 * * * *", label: "Cliente aguardando o corretor" },
  "auto-sale": { path: "/api/internal/jobs/auto-sale", cron: "* * * * *", label: "Venda Automatizada" },
  "stale-stages": { path: "/api/internal/jobs/stale-stages", cron: "0 12 * * *", label: "Regra de chat parado" },
  "daily-report": { path: "/api/internal/jobs/daily-report", cron: "0 11 * * *", label: "Relatório das 8h" },
  "plantao-report": { path: "/api/internal/jobs/plantao-report", cron: "0 22 * * *", label: "Resultado do plantão" },
  // 02:55 UTC = 23:55 em São Paulo: a foto sai com o dia de SP que está terminando.
  // Auto-reparo WhatsApp (flags desligadas por padrão). Horário em UTC; o aviso de véspera confere a hora de São Paulo.
  "whatsapp-autorreparo": { path: "/api/internal/jobs/whatsapp-autorreparo", cron: "0 * * * *", label: "Auto-reparo do WhatsApp" },
  "negotiation-snapshot": { path: "/api/internal/jobs/negotiation-snapshot", cron: "55 2 * * *", label: "Foto diária do fechamento" },
} as const;

export type JobKey = keyof typeof JOB_SCHEDULE;

export function isJobKey(value: string): value is JobKey {
  return Object.prototype.hasOwnProperty.call(JOB_SCHEDULE, value);
}

type FieldMatcher = (value: number) => boolean;

/** Um campo do cron: `*`, `*\/N` ou um número. É tudo o que o runbook usa; outra forma é erro de configuração. */
function parseField(field: string, min: number, max: number): FieldMatcher {
  if (field === "*") return () => true;
  const step = /^\*\/(\d+)$/.exec(field);
  if (step) {
    const every = Number(step[1]);
    if (!every) throw new Error(`Passo de cron inválido: ${field}`);
    return (value) => (value - min) % every === 0;
  }
  if (/^\d+$/.test(field)) {
    const fixed = Number(field);
    if (fixed < min || fixed > max) throw new Error(`Valor de cron fora da faixa: ${field}`);
    return (value) => value === fixed;
  }
  throw new Error(`Forma de cron não suportada: ${field}`);
}

const MINUTE_MS = 60_000;
/** O cron mais espaçado do runbook é diário: dois dias cobrem qualquer próxima rodada. */
const SEARCH_LIMIT_MINUTES = 2 * 24 * 60;

/**
 * Próximo instante (estritamente depois de `now`, no segundo zero) em que o cron dispara, em UTC.
 * Puro: o relógio vem de quem chama. Só minuto e hora são lidos; dia, mês e dia da semana precisam ser `*`.
 */
export function nextRunAt(cron: string, now: Date): Date {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Cron precisa de 5 campos: ${cron}`);
  const [minuteField, hourField, ...rest] = fields;
  if (rest.some((field) => field !== "*")) throw new Error(`Só minuto e hora são suportados: ${cron}`);
  const minute = parseField(minuteField, 0, 59);
  const hour = parseField(hourField, 0, 23);
  let candidate = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  for (let index = 0; index < SEARCH_LIMIT_MINUTES; index += 1, candidate += MINUTE_MS) {
    const date = new Date(candidate);
    if (minute(date.getUTCMinutes()) && hour(date.getUTCHours())) return date;
  }
  throw new Error(`Cron sem próxima rodada em dois dias: ${cron}`);
}

/** Intervalo típico entre duas rodadas, em ms (o primeiro e o segundo disparos depois de `now`). */
export function cronIntervalMs(cron: string, now: Date): number {
  const first = nextRunAt(cron, now);
  return nextRunAt(cron, first).getTime() - first.getTime();
}

/** Próxima rodada do robô `job`. */
export function nextJobRunAt(job: JobKey, now: Date): Date {
  return nextRunAt(JOB_SCHEDULE[job].cron, now);
}

/**
 * Um evento calculado (ex.: o tempo limite de um lead) só acontece quando o robô roda: arredonda para a primeira
 * rodada a partir do instante. Instante já passado vira a próxima rodada.
 */
export function alignToJobRun(job: JobKey, at: Date, now: Date): Date {
  if (at.getTime() <= now.getTime()) return nextRunAt(JOB_SCHEDULE[job].cron, now);
  // nextRunAt é estrito; um instante futuro exatamente sobre o disparo conta como o próprio disparo.
  return nextRunAt(JOB_SCHEDULE[job].cron, new Date(at.getTime() - 1));
}
