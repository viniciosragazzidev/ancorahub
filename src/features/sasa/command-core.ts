/**
 * Núcleo da Sasá agêntica (fase 1): a frase vira uma intenção tipada, o lead e a data são resolvidos aqui e
 * a execução usa SEMPRE uma ação que o app já tinha (`runChatServerAction`, com as checagens e a auditoria
 * dela). Nada de SQL livre nem id vindo da IA. O servidor e o laboratório usam este mesmo núcleo; só o
 * `run` muda (real ou simulado). Plano: docs/implementations/active/2026-11-19-sasa-agentica.md.
 *
 * Confirmação (D2): ação reversível executa direto e devolve "Desfazer"; leitura responde na hora.
 */
import type { ChatBlock, ChatChoice, ChatLeadRow, ChatServerActionName } from "@/components/chat/types";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

import { classifySasaText, nameHintOf, SASA_STAGE_LABEL, type SasaIntent } from "./intent-rules";
import { clockLabel, parseWhenPtBr, whenLabel } from "./parse-when";
import { firstNameOf, resolveLead, type SasaLead } from "./resolve-entities";

export type SasaReturn = { taskId: string; leadId: string; leadName: string; title: string; dueAt: Date | null };
export type SasaWaiting = { leadId: string; name: string; context: string; urgent: boolean };
export type SasaDuty = { name: string; startsAt: Date; endsAt: Date; paused?: boolean };

/** O que a Sasá enxerga do corretor: carregado pelo servidor só com os dados dele (tenant e usuário da sessão). */
export type SasaWorld = {
  now: Date;
  availability: "available" | "paused" | "offline";
  leads: SasaLead[];
  returns: SasaReturn[];
  waiting: SasaWaiting[];
  duty: { active: SasaDuty | null; next: SasaDuty | null };
};

export type SasaActionResult = { ok: boolean; message: string; warning?: boolean; undo?: { label: string; action: { kind: "server"; name: ChatServerActionName; payload: Record<string, string> } } };
export type SasaRun = (name: ChatServerActionName, payload: Record<string, string>) => Promise<SasaActionResult>;

/** Resposta ao corretor. `handled: false` = não é um pedido da fase 1 (segue para a resposta por IA). */
export type SasaReply = {
  handled: boolean;
  blocks: ChatBlock[];
  tool?: SasaIntent["tool"];
  /** Rodou uma ação de escrita: o nome dela e se o servidor confirmou (para o feedback de nível 1). */
  executed?: { action: ChatServerActionName; ok: boolean; warning?: boolean };
};

export type SasaCommandInput = {
  text: string;
  /** Escolhido por toque depois de "Qual Carlos?". O servidor só aceita um id que esteja em `world.leads`. */
  pickedLeadId?: string | null;
  clientCommandId?: string | null;
};

/** Valor de uma escolha local que repete o pedido com o lead escolhido. */
export const SASA_PICK_PREFIX = "sasa:";
export function sasaPickValue(text: string, leadId: string) {
  return `${SASA_PICK_PREFIX}${JSON.stringify({ t: text, l: leadId })}`;
}
export function readSasaPick(value: string): { text: string; leadId: string | null } | null {
  if (!value.startsWith(SASA_PICK_PREFIX)) return null;
  try {
    const data = JSON.parse(value.slice(SASA_PICK_PREFIX.length)) as { t?: unknown; l?: unknown };
    return typeof data.t === "string" ? { text: data.t.slice(0, 500), leadId: typeof data.l === "string" ? data.l : null } : null;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, string> = {
  new: "Novo", distributed: "Aguardando atendimento", in_contact: "Em atendimento", quote_sent: "Cotação enviada", negotiation: "Em negociação",
  documentation_pending: "Documentação pendente", under_analysis: "Em análise", awaiting_reply: "Aguardando resposta",
};

const initialsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("");

const sasaSay = (id: string, text: string): ChatBlock => ({ type: "assistant", id, text });

/** O mundo da Sasá a partir dos dados do dia que o app já carrega para o corretor. */
export function sasaWorldOf(data: BrokerWorkspaceData, now: Date): SasaWorld {
  const waitingKinds = new Set(["new_lead", "sla_risk", "sla_overdue", "awaiting_response"]);
  return {
    now,
    availability: data.viewer.availabilityStatus,
    leads: data.queue.map((lead) => ({ id: lead.id, name: lead.name, status: lead.status })),
    returns: data.agenda.map((item) => ({ taskId: item.id, leadId: item.leadId, leadName: item.leadName, title: item.title, dueAt: item.dueAt })),
    waiting: data.queue
      .filter((lead) => lead.nextAction && waitingKinds.has(lead.nextAction.kind))
      .map((lead) => ({
        leadId: lead.id,
        name: lead.name,
        context: lead.nextAction!.kind === "awaiting_response" ? "Respondeu e espera você" : lead.nextAction!.kind === "new_lead" ? "Lead novo esperando aceite" : "Esperando o 1º contato",
        urgent: lead.nextAction!.kind === "sla_overdue" || lead.nextAction!.kind === "sla_risk",
      })),
    duty: {
      active: data.duty?.active ? { name: data.duty.active.scheduleName, startsAt: data.duty.active.startsAt, endsAt: data.duty.active.endsAt, paused: data.duty.active.paused } : null,
      next: data.duty?.next ? { name: data.duty.next.scheduleName, startsAt: data.duty.next.startsAt, endsAt: data.duty.next.endsAt } : null,
    },
  };
}

type Plan =
  | { kind: "answer"; blocks: ChatBlock[] }
  | { kind: "run"; name: ChatServerActionName; payload: Record<string, string>; done: string; failed: string };

function dayDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" }).format(date);
}

function dutyAnswer(world: SasaWorld, stamp: string): Plan {
  const { active, next } = world.duty;
  const lines: string[] = [];
  if (active) lines.push(`Você está no plantão ${active.name}, das ${clockLabel(active.startsAt)} às ${clockLabel(active.endsAt)}${active.paused || world.availability === "paused" ? ", com o recebimento pausado" : ""}.`);
  if (next) lines.push(`${active ? "O próximo" : "Seu próximo plantão"} é ${next.name}, ${dayDate(next.startsAt)}, das ${clockLabel(next.startsAt)} às ${clockLabel(next.endsAt)}.`);
  if (!lines.length) lines.push("Você não tem plantão marcado. Quando o supervisor colocar você na escala, ele aparece em Plantões.");
  return {
    kind: "answer",
    blocks: [
      sasaSay(`sasa-duty-${stamp}`, lines.join(" ")),
      { type: "question", id: `sasa-duty-open-${stamp}`, prompt: "Quer ver a escala?", choices: [{ id: "open-duty", label: "Ver plantões", action: { kind: "href", href: "/plantoes" } }] },
    ],
  };
}

function waitingAnswer(world: SasaWorld, stamp: string): Plan {
  if (!world.waiting.length) return { kind: "answer", blocks: [sasaSay(`sasa-waiting-${stamp}`, "Ninguém está esperando por você agora. Quando um lead responder, eu mostro aqui.")] };
  const ordered = [...world.waiting].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const rows: ChatLeadRow[] = ordered.slice(0, 8).map((lead) => ({
    leadId: lead.leadId, name: lead.name, initials: initialsOf(lead.name), context: lead.context,
    ...(lead.urgent ? { chip: { label: "Atrasando", tone: "warning" as const } } : {}),
  }));
  const count = ordered.length;
  return {
    kind: "answer",
    blocks: [
      sasaSay(`sasa-waiting-${stamp}`, `${count === 1 ? "1 pessoa está" : `${count} pessoas estão`} esperando você. Comece por ${firstNameOf(ordered[0]!.name)}.`),
      { type: "leads", id: `sasa-waiting-list-${stamp}`, title: "Esperando você", icon: "reply", rows, emptyText: "Ninguém esperando.", updatedAt: clockLabel(world.now) },
    ],
  };
}

function agendaAnswer(world: SasaWorld, stamp: string): Plan {
  const endOfToday = parseWhenPtBr("hoje às 23:59", world.now)?.at ?? world.now;
  const items = world.returns
    .filter((item) => !item.dueAt || item.dueAt.getTime() <= endOfToday.getTime())
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  if (!items.length) {
    const later = world.returns.filter((item) => item.dueAt).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0];
    return { kind: "answer", blocks: [sasaSay(`sasa-agenda-${stamp}`, later ? `Hoje está livre. O próximo retorno é com ${firstNameOf(later.leadName)}, ${whenLabel(later.dueAt!, world.now)}.` : "Sua agenda está livre. Para marcar, é só dizer: \"marca retorno com a Ana amanhã às 10\".")] };
  }
  const late = items.filter((item) => item.dueAt && item.dueAt.getTime() < world.now.getTime()).length;
  return {
    kind: "answer",
    blocks: [
      sasaSay(`sasa-agenda-${stamp}`, `Hoje você tem ${items.length === 1 ? "1 retorno" : `${items.length} retornos`}${late ? `, ${late === 1 ? "1 atrasado" : `${late} atrasados`}` : ""}.`),
      {
        type: "list", id: `sasa-agenda-list-${stamp}`, title: "Sua agenda",
        items: items.slice(0, 8).map((item) => ({
          id: item.taskId, lead: item.leadId, primary: item.leadName, secondary: item.title,
          trailing: item.dueAt ? (item.dueAt.getTime() < world.now.getTime() ? `Atrasado · ${clockLabel(item.dueAt)}` : clockLabel(item.dueAt)) : "Sem hora",
          href: `/leads/${item.leadId}`,
        })),
      },
    ],
  };
}

/** Resolve o lead do pedido; em dúvida ou sem achar, devolve a pergunta a fazer. */
function leadOf(input: SasaCommandInput, world: SasaWorld, stamp: string, hint: string | null): { lead: SasaLead } | { plan: Plan } {
  if (input.pickedLeadId) {
    const lead = world.leads.find((item) => item.id === input.pickedLeadId);
    if (lead) return { lead };
    return { plan: { kind: "answer", blocks: [sasaSay(`sasa-lead-gone-${stamp}`, "Esse lead não está mais com você. Nada foi alterado.")] } };
  }
  const match = resolveLead(input.text, world.leads, hint);
  if (match.kind === "one") return { lead: match.lead };
  if (match.kind === "many") {
    const choices: ChatChoice[] = match.leads.map((lead) => ({ id: `pick-${lead.id}`, label: lead.name, hint: STATUS_LABEL[lead.status] ?? undefined, reply: lead.name, action: { kind: "local", value: sasaPickValue(input.text, lead.id) } }));
    return { plan: { kind: "answer", blocks: [{ type: "question", id: `sasa-pick-${stamp}`, prompt: `Qual ${firstNameOf(match.leads[0]!.name)}?`, choices }] } };
  }
  const name = hint ?? nameHintOf(input.text);
  return {
    plan: {
      kind: "answer",
      blocks: [
        sasaSay(`sasa-lead-none-${stamp}`, name ? `Não achei ${name} entre os seus leads. Nada foi alterado.` : "De qual lead você está falando? Diga o nome, por exemplo: \"marca retorno com a Ana amanhã às 10\"."),
        { type: "question", id: `sasa-lead-none-open-${stamp}`, prompt: "Quer procurar na lista?", choices: [{ id: "open-queue", label: "Ver meus leads", action: { kind: "href", href: "/minha-fila" } }] },
      ],
    },
  };
}

function openReturnsOf(world: SasaWorld, leadId: string) {
  return world.returns.filter((item) => item.leadId === leadId).sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
}

function plan(intent: SasaIntent, input: SasaCommandInput, world: SasaWorld, stamp: string, hint: string | null, whenText: string | null): Plan {
  switch (intent.tool) {
    case "duty.next": return dutyAnswer(world, stamp);
    case "leads.waiting": return waitingAnswer(world, stamp);
    case "agenda.list": return agendaAnswer(world, stamp);
    case "duty.pause":
      if (world.availability === "paused") return { kind: "answer", blocks: [sasaSay(`sasa-paused-${stamp}`, "Você já está pausado. Para voltar, diga \"volta a receber\".")] };
      return { kind: "run", name: "duty.pause", payload: {}, done: "Pausei. Você não recebe leads novos até voltar.", failed: "Não consegui pausar. Você continua recebendo." };
    case "duty.resume":
      if (world.availability === "available") return { kind: "answer", blocks: [sasaSay(`sasa-available-${stamp}`, "Você já está recebendo leads.")] };
      return { kind: "run", name: "duty.resume", payload: {}, done: "Pronto, você voltou a receber leads.", failed: "Não consegui voltar você. Seu recebimento continua pausado." };
    case "returns.schedule": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const lead = found.lead;
      const name = firstNameOf(lead.name);
      const replace = intent.reschedule ? openReturnsOf(world, lead.id)[0] : undefined;
      const when = parseWhenPtBr(whenText ?? input.text, world.now);
      if (!when) {
        const presets: Array<[string, string]> = [["today", "Hoje às 18h"], ["tomorrow", "Amanhã às 9h"], ["in_2_days", "Daqui a 2 dias"]];
        return {
          kind: "answer",
          blocks: [{
            type: "question", id: `sasa-when-${stamp}`, prompt: `Para quando o retorno com ${name}?`,
            choices: presets.map(([value, label]) => ({ id: `when-${value}`, label, action: { kind: "server", name: "lead.scheduleReturn", payload: { leadId: lead.id, when: value, ...(replace ? { taskId: replace.taskId } : {}) } } })),
          }],
        };
      }
      const label = whenLabel(when.at, world.now);
      return {
        kind: "run", name: "lead.scheduleReturn",
        payload: { leadId: lead.id, at: when.at.toISOString(), ...(replace ? { taskId: replace.taskId } : {}) },
        done: `${replace ? "Remarquei" : "Combinado"}: retorno com ${name} ${label}. Está na sua Agenda.`,
        failed: `Não consegui marcar o retorno com ${name}. Nada foi alterado.`,
      };
    }
    case "returns.complete":
    case "returns.cancel": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const name = firstNameOf(found.lead.name);
      const open = openReturnsOf(world, found.lead.id)[0];
      if (!open) return { kind: "answer", blocks: [sasaSay(`sasa-no-return-${stamp}`, `${name} não tem retorno aberto na sua Agenda.`)] };
      return intent.tool === "returns.complete"
        ? { kind: "run", name: "lead.completeReturn", payload: { taskId: open.taskId, leadName: name }, done: `Boa. Tirei o retorno com ${name} da sua Agenda.`, failed: `Não consegui concluir o retorno com ${name}. Ele continua na Agenda.` }
        : { kind: "run", name: "lead.cancelReturn", payload: { taskId: open.taskId, leadName: name }, done: `Cancelei o retorno com ${name}.`, failed: `Não consegui cancelar o retorno com ${name}. Ele continua na Agenda.` };
    }
    case "lead.stage": {
      const found = leadOf(input, world, stamp, hint);
      if ("plan" in found) return found.plan;
      const name = firstNameOf(found.lead.name);
      const stage = SASA_STAGE_LABEL[intent.status];
      if (found.lead.status === intent.status) return { kind: "answer", blocks: [sasaSay(`sasa-same-stage-${stamp}`, `${name} já está em ${stage}.`)] };
      return { kind: "run", name: "lead.changeStep", payload: { leadId: found.lead.id, status: intent.status, previous: found.lead.status }, done: `Pronto: ${name} agora está em ${stage}.`, failed: `Não consegui mudar a etapa de ${name}. Ela continua como estava.` };
    }
  }
}

/**
 * Roda um pedido. `intent` vem da IA quando as regras não casaram; sem ela, só as regras.
 * Sucesso só depois da confirmação do servidor; erro diz o que continua valendo e oferece "Tentar de novo".
 */
export async function runSasaCommand(input: SasaCommandInput & {
  world: SasaWorld;
  run: SasaRun;
  intent?: SasaIntent | null;
  leadHint?: string | null;
  whenText?: string | null;
  stamp?: string;
}): Promise<SasaReply> {
  const intent = input.intent ?? classifySasaText(input.text);
  if (!intent) return { handled: false, blocks: [] };
  const stamp = input.stamp ?? String(input.world.now.getTime());
  const next = plan(intent, input, input.world, stamp, input.leadHint ?? null, input.whenText ?? null);
  if (next.kind === "answer") return { handled: true, tool: intent.tool, blocks: next.blocks };

  let result: SasaActionResult;
  try {
    result = await input.run(next.name, next.payload);
  } catch {
    result = { ok: false, message: next.failed };
  }
  const retry: ChatBlock = {
    type: "question", id: `sasa-retry-${stamp}`, prompt: "Quer tentar de novo?",
    choices: [{ id: "retry", label: "Tentar de novo", reply: input.text, action: { kind: "local", value: sasaPickValue(input.text, input.pickedLeadId ?? "") } }],
  };
  if (!result.ok) return { handled: true, tool: intent.tool, executed: { action: next.name, ok: false }, blocks: [sasaSay(`sasa-failed-${stamp}`, next.failed), retry] };
  const blocks: ChatBlock[] = [sasaSay(`sasa-done-${stamp}`, result.warning ? result.message : next.done)];
  if (result.undo) blocks.push({ type: "question", id: `sasa-undo-${stamp}`, prompt: "Foi sem querer?", choices: [{ id: "undo", label: result.undo.label, action: result.undo.action }] });
  return { handled: true, tool: intent.tool, executed: { action: next.name, ok: true, warning: result.warning }, blocks };
}
