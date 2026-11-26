/**
 * "Exigir verificação em duas etapas da equipe" (26/11/2026, Segurança e LGPD). Regra pura, sem banco: o layout do
 * (dashboard) chama `evaluateTwoFactorRequirement` com o que já leu na consulta do shell.
 *
 * - O diretor escolhe a partir de qual papel exige (toda a equipe ou só a gestão) e a carência em dias (0 a 30).
 * - Fica guardado por empresa em system_settings (`two_factor_policy:<tenantId>`), como as outras escolhas do diretor.
 * - Passkey (chave de acesso) conta como segundo fator.
 * - A carência conta do dia em que a exigência foi ligada ou do dia em que a pessoa entrou na empresa, o que vier
 *   depois, e termina à meia-noite de Brasília do último dia (o fuso é sempre America/Sao_Paulo, nunca o do servidor).
 */

export type TwoFactorPolicyScope = "off" | "team" | "management";

export type TwoFactorPolicy = {
  scope: TwoFactorPolicyScope;
  /** Dias de carência, de 0 (na hora) a 30. */
  graceDays: number;
  /** Quando a exigência foi ligada (ISO). Null com a exigência desligada. */
  since: string | null;
};

export type TwoFactorRequirement =
  | { state: "free" }
  | { state: "grace"; deadline: Date; daysLeft: number }
  | { state: "blocked"; deadline: Date };

export const MIN_TWO_FACTOR_GRACE_DAYS = 0;
export const MAX_TWO_FACTOR_GRACE_DAYS = 30;
export const DEFAULT_TWO_FACTOR_GRACE_DAYS = 7;
export const TWO_FACTOR_POLICY_TIME_ZONE = "America/Sao_Paulo";
/** Onde se configura o 2FA: essa tela nunca é travada. */
export const TWO_FACTOR_SETUP_PATH = "/settings";
export const TWO_FACTOR_SETUP_HREF = "/settings?tab=seguranca";

export const DISABLED_TWO_FACTOR_POLICY: TwoFactorPolicy = { scope: "off", graceDays: DEFAULT_TWO_FACTOR_GRACE_DAYS, since: null };

const SCOPE_ROLES: Record<Exclude<TwoFactorPolicyScope, "off">, readonly string[]> = {
  team: ["broker", "supervisor", "manager", "director"],
  management: ["supervisor", "manager", "director"],
};

export function twoFactorPolicyKey(tenantId: string) {
  return `two_factor_policy:${tenantId}`;
}

export function parseTwoFactorGraceDays(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(number) || number < MIN_TWO_FACTOR_GRACE_DAYS || number > MAX_TWO_FACTOR_GRACE_DAYS) return null;
  return number;
}

export function parseTwoFactorPolicyScope(value: unknown): TwoFactorPolicyScope | null {
  return value === "off" || value === "team" || value === "management" ? value : null;
}

/** Lê o valor gravado. Qualquer coisa inválida vale como desligado (nunca trava ninguém por dado quebrado). */
export function parseTwoFactorPolicy(raw: string | null | undefined): TwoFactorPolicy {
  if (!raw) return DISABLED_TWO_FACTOR_POLICY;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const scope = parseTwoFactorPolicyScope(value.scope);
    const graceDays = parseTwoFactorGraceDays(value.graceDays);
    if (!scope || graceDays === null) return DISABLED_TWO_FACTOR_POLICY;
    if (scope === "off") return { scope, graceDays, since: null };
    const since = typeof value.since === "string" && !Number.isNaN(Date.parse(value.since)) ? value.since : null;
    if (!since) return DISABLED_TWO_FACTOR_POLICY;
    return { scope, graceDays, since };
  } catch {
    return DISABLED_TWO_FACTOR_POLICY;
  }
}

/**
 * A política a gravar. Ligar (de desligado para ligado) marca `since` agora; mudar papel ou dias com ela já ligada
 * mantém o começo da carência, para ninguém ganhar prazo novo só porque o diretor ajustou a regra.
 */
export function nextTwoFactorPolicy(previous: TwoFactorPolicy, input: { scope: TwoFactorPolicyScope; graceDays: number }, now: Date): TwoFactorPolicy {
  if (input.scope === "off") return { scope: "off", graceDays: input.graceDays, since: null };
  const since = previous.scope !== "off" && previous.since ? previous.since : now.toISOString();
  return { scope: input.scope, graceDays: input.graceDays, since };
}

export function serializeTwoFactorPolicy(policy: TwoFactorPolicy) {
  return JSON.stringify(policy);
}

export function isRoleRequiredByTwoFactorPolicy(scope: TwoFactorPolicyScope, role: string) {
  if (scope === "off") return false;
  return SCOPE_ROLES[scope].includes(role);
}

/** A tela de configurar o 2FA (e tudo dentro de /settings) nunca é travada. */
export function isTwoFactorSetupPath(pathname: string) {
  const path = pathname.split("?")[0];
  return path === TWO_FACTOR_SETUP_PATH || path.startsWith(`${TWO_FACTOR_SETUP_PATH}/`);
}

const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: TWO_FACTOR_POLICY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const offsetParts = new Intl.DateTimeFormat("en-US", { timeZone: TWO_FACTOR_POLICY_TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Dia civil em Brasília (yyyy-mm-dd como número de dias desde 1970), para contar dias sem depender do fuso do servidor. */
function saoPauloDayNumber(instant: Date) {
  const parts = Object.fromEntries(dateParts.formatToParts(instant).map((part) => [part.type, part.value]));
  return Math.floor(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000);
}

/** Diferença (ms) entre o relógio de Brasília e o UTC naquele instante. */
function saoPauloOffsetMs(instant: Date) {
  const parts = Object.fromEntries(offsetParts.formatToParts(instant).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Meia-noite de Brasília do dia `dayNumber`. */
function saoPauloMidnight(dayNumber: number) {
  const guess = new Date(dayNumber * 86_400_000);
  return new Date(guess.getTime() - saoPauloOffsetMs(guess));
}

/** Fim da carência: começo + N dias, à meia-noite de Brasília. Com 0 dias, vale na hora. */
export function twoFactorGraceDeadline(start: Date, graceDays: number) {
  if (graceDays <= 0) return start;
  return saoPauloMidnight(saoPauloDayNumber(start) + graceDays);
}

export function evaluateTwoFactorRequirement(input: {
  policy: TwoFactorPolicy;
  role: string;
  hasTwoFactor: boolean;
  hasPasskey: boolean;
  /** Quando a pessoa entrou na empresa (membership). */
  memberSince?: Date | string | null;
  now?: Date;
}): TwoFactorRequirement {
  const { policy } = input;
  if (policy.scope === "off" || !policy.since) return { state: "free" };
  if (!isRoleRequiredByTwoFactorPolicy(policy.scope, input.role)) return { state: "free" };
  if (input.hasTwoFactor || input.hasPasskey) return { state: "free" };
  const now = input.now ?? new Date();
  const since = new Date(policy.since);
  const member = input.memberSince ? new Date(input.memberSince) : null;
  const start = member && !Number.isNaN(member.getTime()) && member > since ? member : since;
  const deadline = twoFactorGraceDeadline(start, policy.graceDays);
  if (now >= deadline) return { state: "blocked", deadline };
  const daysLeft = Math.max(1, saoPauloDayNumber(new Date(deadline.getTime() - 1)) - saoPauloDayNumber(now) + 1);
  return { state: "grace", deadline, daysLeft };
}

/** Texto do aviso da carência ("Faltam 3 dias" / "Hoje é o último dia"). */
export function twoFactorGraceLabel(daysLeft: number) {
  return daysLeft <= 1 ? "Hoje é o último dia para ativar." : `Faltam ${daysLeft} dias para ativar.`;
}
