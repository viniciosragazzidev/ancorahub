import type { ChatBlock, ChatScript, ThreadSummary } from "@/components/chat/types";
import { ASSISTANTS } from "@/features/broker-workspace/chat/assistant-scripts";
import { formatDuration, RANK_LABEL } from "@/features/engagement/ranking";

import type { SupervisorWorkspaceData, TeamBroker } from "./queries";

const TIME_ZONE = "America/Sao_Paulo";
const hhmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
const AVAILABILITY: Record<string, string> = { available: "Disponível", paused: "Pausado", offline: "Fora do ar" };

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function minutesSince(date: Date | null, now: Date) {
  return date ? Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000)) : null;
}

function thread(id: "ancora" | "equipe" | "equipe-leads" | "equipe-plantao" | "equipe-desempenho", values: Pick<ThreadSummary, "preview" | "at" | "unread" | "waitingYou">): ThreadSummary {
  const definition = ASSISTANTS[id];
  return { id: `assistant:${id}`, kind: "assistant", assistant: id, name: definition.name, verified: definition.verified, href: definition.href, shape: definition.shape, hue: definition.hue, ...values };
}

/** Who on the team needs the supervisor first (late first contacts, then waiting ones). */
function brokersNeedingAttention(team: TeamBroker[]) {
  return [...team].filter((broker) => broker.late > 0 || broker.waiting > 0).sort((a, b) => b.late - a.late || b.waiting - a.waiting);
}

/** The supervisor's conversation list: the team assistants plus Âncora. */
export function buildSupervisorThreads(data: SupervisorWorkspaceData, now: Date): ThreadSummary[] {
  const needing = brokersNeedingAttention(data.team);
  const online = data.team.filter((broker) => broker.availability === "available").length;
  const best = [...data.team].sort((a, b) => (b.stats?.accepted ?? 0) - (a.stats?.accepted ?? 0))[0];
  return [
    thread("ancora", {
      preview: data.unreadNotifications ? data.latestNotificationTitle ?? `Você tem ${data.unreadNotifications} avisos novos.` : "Sem avisos novos.",
      at: data.unreadNotifications ? now.toISOString() : null,
      unread: data.unreadNotifications > 0,
      waitingYou: false,
    }),
    thread("equipe", {
      preview: !data.team.length
        ? "Sua equipe ainda não foi montada. Peça ao gestor."
        : needing.length
          ? `${firstName(needing[0]!.name)} precisa de você: ${needing[0]!.late ? `${needing[0]!.late} lead(s) atrasado(s)` : `${needing[0]!.waiting} esperando contato`}.`
          : `${online} de ${data.team.length} disponíveis. Tudo em dia.`,
      at: now.toISOString(),
      unread: false,
      waitingYou: needing.some((broker) => broker.late > 0),
    }),
    thread("equipe-leads", {
      preview: data.today.late
        ? `${data.today.late} lead(s) com primeiro contato atrasado.`
        : data.today.waiting ? `${data.today.waiting} lead(s) esperando o primeiro contato.` : "Nenhum lead parado na equipe.",
      at: data.attention[0]?.assignedAt?.toISOString() ?? null,
      unread: false,
      waitingYou: data.today.late > 0,
    }),
    thread("equipe-plantao", {
      preview: !data.duty.length
        ? "Ninguém da equipe escalado hoje."
        : (() => {
          const pending = data.duty.filter((item) => item.presence === "pending").length;
          const absent = data.duty.filter((item) => item.presence === "absent").length;
          return absent ? `${absent} falta(s) no plantão de hoje.` : pending ? `${pending} esperando confirmar presença.` : `${data.duty.length} da equipe de plantão hoje.`;
        })(),
      at: null,
      unread: false,
      waitingYou: data.duty.some((item) => item.presence === "absent"),
    }),
    thread("equipe-desempenho", {
      preview: best?.stats?.accepted ? `${firstName(best.name)} lidera a semana com ${best.stats.accepted} aceites.` : "Placar da semana da sua equipe.",
      at: null,
      unread: false,
      waitingYou: false,
    }),
  ];
}

/** "Leads" tab of the supervisor: the team's leads that need attention, as conversations. */
export function buildSupervisorLeadThreads(data: SupervisorWorkspaceData, now: Date): ThreadSummary[] {
  return data.attention.map((lead) => {
    const minutes = minutesSince(lead.assignedAt, now);
    return {
      id: `lead:${lead.leadId}`,
      kind: "lead" as const,
      leadId: lead.leadId,
      name: lead.name,
      preview: `${firstName(lead.brokerName)} · ${lead.late ? "contato atrasado" : "esperando contato"}${minutes !== null ? ` há ${formatDuration(minutes * 60)}` : ""}`,
      at: lead.assignedAt?.toISOString() ?? null,
      unread: false,
      waitingYou: lead.late,
      href: `/leads/${lead.leadId}`,
      shape: "mochi" as const,
      hue: null,
      initials: initials(lead.name),
    };
  });
}

const date = (id: string, now: Date): ChatBlock => ({ type: "date", id, label: `Hoje, ${hhmm(now)}` });
const say = (id: string, text: string): ChatBlock => ({ type: "assistant", id, text });

function emptyTeam(now: Date, prefix: string): ChatScript {
  return {
    blocks: [
      date(`${prefix}-date`, now),
      say(`${prefix}-empty`, "Sua equipe ainda está vazia. Monte em Minha equipe: dê nome e foto, adicione ou convide corretores da sua unidade."),
      { type: "question", id: `${prefix}-empty-choice`, prompt: "Vamos montar?", choices: [{ id: "my-team", label: "Montar minha equipe", action: { kind: "href", href: "/equipe/minha" } }] },
    ],
    status: { label: "Sem equipe", tone: "idle" },
  };
}

/** Equipe: who is available, who needs the supervisor, a card per broker. */
/** P2: free brokers of the unit, one tap to add each (the server re-checks every rule). */
function freeBrokersBlocks(data: SupervisorWorkspaceData): ChatBlock[] {
  if (!data.freeBrokers.length) return [];
  return [
    say("equipe-free", `${data.freeBrokers.length === 1 ? "1 corretor" : `${data.freeBrokers.length} corretores`} da sua unidade ${data.freeBrokers.length === 1 ? "está" : "estão"} sem supervisor.`),
    {
      type: "question",
      id: "equipe-free-choice",
      prompt: "Quer adicionar à sua equipe?",
      choices: data.freeBrokers.slice(0, 6).map((broker) => ({
        id: `add-${broker.userId}`,
        label: `Adicionar ${broker.name}`,
        reply: `Adicionar ${firstName(broker.name)} à minha equipe`,
        action: { kind: "server" as const, name: "team.addBroker" as const, payload: { brokerId: broker.userId } },
      })),
    },
  ];
}

function teamScript(data: SupervisorWorkspaceData, now: Date): ChatScript {
  if (!data.team.length) {
    const empty = emptyTeam(now, "equipe");
    return { ...empty, blocks: [...empty.blocks, ...freeBrokersBlocks(data)] };
  }
  const needing = brokersNeedingAttention(data.team);
  const online = data.team.filter((broker) => broker.availability === "available").length;
  const blocks: ChatBlock[] = [
    date("equipe-date", now),
    say("equipe-hello", `${greeting(now)}, ${firstName(data.viewer.name)}. Sua equipe tem ${data.team.length} corretores, ${online} disponíveis agora.`),
    {
      type: "list",
      id: "equipe-list",
      title: "Sua equipe",
      items: data.team.map((broker) => ({
        id: broker.userId,
        primary: broker.name,
        secondary: `${AVAILABILITY[broker.availability] ?? broker.availability} · ${broker.inService} em atendimento${broker.waiting ? ` · ${broker.waiting} esperando contato` : ""}`,
        trailing: broker.late ? `${broker.late} atrasado(s)` : broker.receivedToday ? `${broker.receivedToday} hoje` : undefined,
        href: `/equipe/${broker.userId}`,
      })),
    },
  ];
  if (needing.length) {
    blocks.push(say("equipe-needing", `Precisam de você agora: ${needing.slice(0, 3).map((broker) => `${firstName(broker.name)} (${broker.late ? `${broker.late} atrasado(s)` : `${broker.waiting} esperando`})`).join(", ")}.`));
  } else {
    blocks.push(say("equipe-ok", "Ninguém com lead parado. Bom momento para reconhecer quem está indo bem."));
  }
  blocks.push(...freeBrokersBlocks(data));
  blocks.push({
    type: "question",
    id: "equipe-choice",
    prompt: "O que você quer fazer?",
    choices: [
      ...(needing[0] ? [{ id: "open-needing", label: `Ver ${firstName(needing[0].name)}`, action: { kind: "href" as const, href: `/equipe/${needing[0].userId}` } }] : []),
      { id: "message", label: "Mandar recado para a equipe", hint: "Pela Central de relacionamento", action: { kind: "href", href: "/relacionamento" } },
      { id: "team-page", label: "Minha equipe", hint: "Perfil, membros e convites", action: { kind: "href", href: "/equipe/minha" } },
    ],
  });
  return { blocks, status: needing.some((broker) => broker.late) ? { label: "Precisa de você", tone: "waiting" } : { label: "Equipe em dia", tone: "idle" } };
}

/** Leads da equipe: the stuck ones first, each opening the lead. */
function teamLeadsScript(data: SupervisorWorkspaceData, now: Date): ChatScript {
  if (!data.team.length) return emptyTeam(now, "equipe-leads");
  const blocks: ChatBlock[] = [
    date("equipe-leads-date", now),
    say("equipe-leads-summary", data.today.late
      ? `${data.today.late} lead(s) passaram do prazo de ${data.slaMinutes} min sem primeiro contato. Comece por eles.`
      : data.today.waiting ? `${data.today.waiting} lead(s) esperando o primeiro contato, ainda no prazo.` : "Nenhum lead parado na equipe agora."),
  ];
  if (data.attention.length) {
    blocks.push({
      type: "list",
      id: "equipe-leads-list",
      title: "Leads esperando contato",
      items: data.attention.map((lead) => {
        const minutes = minutesSince(lead.assignedAt, now);
        return {
          id: lead.leadId,
          lead: lead.leadId,
          primary: lead.name,
          secondary: `${lead.brokerName}${lead.assignedAt ? ` · desde ${hhmm(lead.assignedAt)}` : ""}`,
          trailing: lead.late ? `atrasado ${minutes !== null ? formatDuration(minutes * 60) : ""}`.trim() : "no prazo",
          href: `/leads/${lead.leadId}`,
        };
      }),
    });
    blocks.push(say("equipe-leads-tip", "Abra o lead para ver a conversa e cobre o corretor. Se ele não puder atender, repasse para outro da equipe."));
    const late = data.attention.filter((lead) => lead.late).slice(0, 3);
    if (late.length && data.team.length > 1) {
      blocks.push({
        type: "question",
        id: "equipe-leads-handoff",
        prompt: "Repassar algum lead atrasado?",
        choices: late.map((lead) => ({ id: `handoff-${lead.leadId}`, label: `Repassar ${firstName(lead.name)}`, hint: `Hoje com ${firstName(lead.brokerName)}`, action: { kind: "href" as const, href: `/equipe/repassar?lead=${lead.leadId}` } })),
      });
    }
  }
  blocks.push({ type: "question", id: "equipe-leads-choice", prompt: "Quer ver mais?", choices: [{ id: "all", label: "Ver todos os leads da equipe", action: { kind: "href", href: "/leads" } }] });
  return { blocks, status: data.today.late ? { label: `${data.today.late} atrasado(s)`, tone: "waiting" } : { label: "Sem atraso", tone: "idle" } };
}

/** Desempenho da equipe: the week of each broker, ranked inside the team only. */
function teamPerformanceScript(data: SupervisorWorkspaceData, now: Date): ChatScript {
  if (!data.team.length) return emptyTeam(now, "equipe-desempenho");
  const ranked = [...data.team].sort((a, b) => (b.stats?.accepted ?? 0) - (a.stats?.accepted ?? 0) || (b.stats?.started ?? 0) - (a.stats?.started ?? 0));
  const blocks: ChatBlock[] = [
    date("equipe-desempenho-date", now),
    say("equipe-desempenho-intro", "A semana da sua equipe (últimos 7 dias), só entre os seus corretores."),
    {
      type: "bars",
      id: "equipe-desempenho-accepted",
      title: "Aceites na semana",
      values: ranked.map((broker, index) => ({ label: firstName(broker.name), value: broker.stats?.accepted ?? 0, highlight: index === 0 && (broker.stats?.accepted ?? 0) > 0 })),
      format: "count",
    },
    {
      type: "list",
      id: "equipe-desempenho-list",
      title: "Por corretor",
      items: ranked.map((broker) => {
        const stats = broker.stats;
        const rate = stats && stats.offered ? `${Math.round((stats.accepted / stats.offered) * 100)}% de aceite` : "sem ofertas";
        const best = broker.ranks[0];
        return {
          id: broker.userId,
          primary: broker.name,
          secondary: `${rate} · aceita em ${formatDuration(stats?.medianAcceptSeconds ?? null)} · ${stats?.started ?? 0} atendimentos`,
          trailing: best ? `${best.position}º ${RANK_LABEL[best.key].replace(/^n[oa]s? /, "")}` : undefined,
          href: `/equipe/${broker.userId}`,
        };
      }),
    },
    { type: "question", id: "equipe-desempenho-choice", prompt: "O que você quer ver?", choices: [
      { id: "leaderboard", label: "Ver o placar", hint: "Posição das equipes da unidade", action: { kind: "href", href: "/equipe/desempenho" } },
      { id: "recognize", label: "Mandar um reconhecimento", hint: "Pela Central de relacionamento", action: { kind: "href", href: "/relacionamento" } },
    ] },
  ];
  return { blocks, status: { label: "Semana da equipe", tone: "idle" } };
}

const PRESENCE: Record<string, string> = { confirmed: "presença confirmada", pending: "esperando confirmar", absent: "faltou", expired: "não confirmou", not_required: "online" };

/** Plantão da equipe (P5): who of the team is on duty today, read only (the roster is the manager's). */
function teamDutyScript(data: SupervisorWorkspaceData, now: Date): ChatScript {
  if (!data.team.length) return emptyTeam(now, "equipe-plantao");
  const blocks: ChatBlock[] = [date("equipe-plantao-date", now)];
  if (!data.duty.length) {
    blocks.push(say("equipe-plantao-empty", "Ninguém da sua equipe está escalado hoje."));
    return { blocks, status: { label: "Sem plantão hoje", tone: "idle" } };
  }
  const absent = data.duty.filter((item) => item.presence === "absent" || item.presence === "expired");
  const pending = data.duty.filter((item) => item.presence === "pending");
  blocks.push(say("equipe-plantao-summary", `${data.duty.length === 1 ? "1 corretor da equipe está" : `${data.duty.length} corretores da equipe estão`} no plantão de hoje.${pending.length ? ` ${pending.length} ainda não confirmou presença.` : ""}${absent.length ? ` ${absent.length} faltou.` : ""}`));
  blocks.push({
    type: "list",
    id: "equipe-plantao-list",
    title: "Plantão de hoje",
    items: data.duty.map((item, index) => ({
      id: `${item.brokerId}-${index}`,
      primary: item.brokerName,
      secondary: `${item.scheduleName} · ${item.startsAt} às ${item.endsAt}${item.paused ? " · pausado" : ""}`,
      trailing: PRESENCE[item.presence] ?? item.presence,
      href: `/equipe/${item.brokerId}`,
    })),
  });
  const follow = [...absent, ...pending].slice(0, 3);
  if (follow.length) {
    blocks.push({
      type: "question",
      id: "equipe-plantao-choice",
      prompt: "Quer falar com alguém?",
      choices: follow.map((item) => ({ id: `duty-${item.brokerId}`, label: `Ver ${firstName(item.brokerName)}`, hint: PRESENCE[item.presence], action: { kind: "href" as const, href: `/equipe/${item.brokerId}` } })),
    });
  }
  return { blocks, status: absent.length ? { label: `${absent.length} falta(s)`, tone: "waiting" } : pending.length ? { label: "Confirmações pendentes", tone: "waiting" } : { label: "Plantão em dia", tone: "idle" } };
}

export type SupervisorScriptId = "equipe" | "equipe-leads" | "equipe-plantao" | "equipe-desempenho";

export function buildSupervisorScript(id: SupervisorScriptId, data: SupervisorWorkspaceData, now: Date): ChatScript {
  switch (id) {
    case "equipe": return teamScript(data, now);
    case "equipe-leads": return teamLeadsScript(data, now);
    case "equipe-plantao": return teamDutyScript(data, now);
    case "equipe-desempenho": return teamPerformanceScript(data, now);
  }
}
