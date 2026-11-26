/**
 * Ações da visão "Esfriando" (26/11/2026): Assumir, Cobrar corretor e Redistribuir um lead parado.
 * Regras puras de quem pode o quê; o servidor (`cooling-lead-actions.ts`) usa as mesmas funções.
 *
 * Escopo: diretor age em qualquer lead da empresa, gestor nos da própria unidade, supervisor só nos leads dos
 * corretores da equipe dele. Corretor não vê nenhuma dessas ações.
 */
import { formatIdle } from "./cooling-radar";

export type CoolingActionId = "assume" | "nudge" | "redistribute";

export const COOLING_ACTION_LABELS: Record<CoolingActionId, string> = {
  assume: "Assumir",
  nudge: "Cobrar corretor",
  redistribute: "Redistribuir",
};

const COOLING_ACTOR_ROLES = ["director", "manager", "supervisor"] as const;

/** Só diretor, gestor e supervisor agem no radar. */
export function canRunCoolingActions(role: string) {
  return (COOLING_ACTOR_ROLES as readonly string[]).includes(role);
}

export type CoolingActor = { role: string; userId: string; branchId: string | null };
export type CoolingLeadScope = { corretorId: string | null; branchId: string | null };

/**
 * O lead está no escopo de quem age? Diretor: empresa (o lead já veio filtrado pelo tenant). Gestor: a unidade dele.
 * Supervisor: o corretor do lead é da equipe dele (`teamBrokerIds`); lead sem corretor fica fora.
 */
export function coolingScopeAllows(actor: CoolingActor, lead: CoolingLeadScope, teamBrokerIds: readonly string[] = []) {
  if (actor.role === "director") return true;
  if (actor.role === "manager") return Boolean(actor.branchId) && lead.branchId === actor.branchId;
  if (actor.role === "supervisor") return Boolean(lead.corretorId) && teamBrokerIds.includes(lead.corretorId!);
  return false;
}

/** Ações que aparecem no ⋯ e na gaveta para este lead. Assumir some quando o lead já é seu; cobrar pede corretor. */
export function coolingActionsFor(actor: { role: string; userId: string }, lead: { corretorId: string | null }): CoolingActionId[] {
  if (!canRunCoolingActions(actor.role)) return [];
  const mine = lead.corretorId === actor.userId;
  const actions: CoolingActionId[] = [];
  if (!mine) actions.push("assume");
  if (lead.corretorId && !mine) actions.push("nudge");
  actions.push("redistribute");
  return actions;
}

const ROLE_NAMES: Record<string, string> = { director: "diretor", manager: "gestor", supervisor: "supervisor" };

/** Prefixo do título da tarefa de cobrança: também evita cobrar duas vezes enquanto a primeira está aberta. */
export const NUDGE_TASK_PREFIX = "Retomar contato com";

/** Prazo da tarefa de cobrança: o corretor tem até 2 horas para dar sinal. */
export const NUDGE_TASK_DUE_MS = 2 * 60 * 60 * 1000;

/** A tarefa que o corretor recebe: nome do lead e há quanto tempo ele está parado. */
export function buildNudgeTask(input: { leadName: string; idleMs: number; actorRole: string; now?: Date }) {
  const name = input.leadName.trim() || "o lead";
  const title = `${NUDGE_TASK_PREFIX} ${name}`.slice(0, 160);
  const who = ROLE_NAMES[input.actorRole] ?? "gestor";
  const description = `Lead parado há ${formatIdle(input.idleMs)}. Pedido do ${who} no radar Esfriando.`;
  const dueAt = new Date((input.now ?? new Date()).getTime() + NUDGE_TASK_DUE_MS).toISOString();
  return { title, description, dueAt, priority: "normal" as const };
}

/** Motivo gravado no repasse (o supervisor precisa de um, com no mínimo 5 caracteres). */
export const COOLING_REDISTRIBUTE_REASON = "Lead parado no radar Esfriando.";
