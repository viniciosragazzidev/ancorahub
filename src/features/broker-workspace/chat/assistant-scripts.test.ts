import { describe, expect, it } from "vitest";

import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import type { BrokerWorkspacePriority } from "@/features/broker-workspace/priority";
import type { ChatBlock, ChatScript } from "@/components/chat/types";
import { ASSISTANTS, buildAssistantScript, buildAssistantThreads, buildLeadThreads } from "./assistant-scripts";

const now = new Date("2026-10-09T12:00:00-03:00");

function workspace(overrides: Partial<BrokerWorkspaceData> = {}): BrokerWorkspaceData {
  return {
    viewer: { tenantId: "tenant-1", userId: "broker-1", name: "Ana Lima", branchName: "Centro", availabilityStatus: "available" },
    nextAction: null,
    duty: null,
    today: {
      awaitingResponse: 0,
      overdueTasks: 0,
      returnsDue: 0,
      newLeads: 0,
      pendingDocuments: 0,
      pendingProposals: 0,
      unreadNotifications: 0,
      receivedToday: 0,
      acceptedToday: 0,
      inServiceNow: 0,
      slaAtRiskNow: 0,
    },
    inbox: [],
    agenda: [],
    queue: [],
    goal: null,
    updatedAt: now,
    ...overrides,
  };
}

function priority(overrides: Partial<BrokerWorkspacePriority> = {}): BrokerWorkspacePriority {
  return {
    kind: "new_lead",
    severity: "warning",
    leadId: "lead-1",
    dueAt: null,
    referenceAt: new Date("2026-10-09T11:40:00-03:00"),
    title: "Clara Souza",
    description: "Novo lead aguardando o primeiro atendimento.",
    href: "/leads/lead-1",
    ...overrides,
  };
}

function lead(overrides: Partial<BrokerWorkspaceData["queue"][number]> = {}): BrokerWorkspaceData["queue"][number] {
  return {
    id: "lead-1",
    name: "Clara Souza",
    status: "new",
    source: "Campanha",
    nextAction: priority(),
    ...overrides,
  };
}

function activeDuty(overrides: Partial<NonNullable<NonNullable<BrokerWorkspaceData["duty"]>["active"]>> = {}) {
  return {
    scheduleId: "schedule-1",
    scheduleName: "PME Centro",
    queueName: "Fila PME",
    branchName: "Centro",
    dutyDate: "2026-10-09",
    startsAt: new Date("2026-10-09T09:00:00-03:00"),
    endsAt: new Date("2026-10-09T18:00:00-03:00"),
    paused: false,
    presenceStatus: "confirmed" as const,
    ...overrides,
  };
}

function textValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(textValues);
  return [];
}

function expectNoEmDash(value: unknown) {
  expect(textValues(value).some((text) => text.includes(String.fromCharCode(0x2014)))).toBe(false);
}

function questionBlocks(script: ChatScript) {
  return script.blocks.filter((block): block is Extract<ChatBlock, { type: "question" }> => block.type === "question");
}

describe("broker chat assistant scripts", () => {
  it("declares assistant identities, mascots, hues and routes from the contract", () => {
    expect(ASSISTANTS).toMatchObject({
      ancora: { name: "Âncora", shape: "logo", verified: true, href: "/notificacoes" },
      leads: { name: "Leads", shape: "mochi", hue: 212, href: "/dashboard/c/leads" },
      plantao: { name: "Plantão", shape: "onigiri", hue: 28, href: "/dashboard/c/plantao" },
      agenda: { name: "Agenda", shape: "cubo", hue: 150, href: "/dashboard/c/agenda" },
      cotacao: { name: "Cotação", shape: "favo", hue: 268, href: "/cotacao" },
      desempenho: { name: "Desempenho", shape: "nuvem", hue: 330, href: "/dashboard/c/desempenho" },
      insights: { name: "Insights", shape: "salte", hue: 200, href: "/conversas/broker" },
    });
  });

  it("builds assistant threads, gates quotation and always keeps plantão and insights", () => {
    const data = workspace();
    const withoutQuote = buildAssistantThreads({ data, capabilities: { quoteSimulator: false, dutyCalendar: false }, now });
    expect(withoutQuote.map((thread) => thread.assistant).sort()).toEqual(["agenda", "ancora", "desempenho", "insights", "leads", "plantao"]);
    expect(withoutQuote.some((thread) => thread.assistant === "plantao" || thread.assistant === "insights")).toBe(true);

    const withQuote = buildAssistantThreads({ data, capabilities: { quoteSimulator: true, dutyCalendar: true }, now });
    expect(withQuote).toHaveLength(7);
    expect(withQuote.some((thread) => thread.assistant === "cotacao")).toBe(true);
    expectNoEmDash(withQuote);

    const withNextDuty = workspace({ duty: {
      active: null,
      next: { scheduleName: "PME Centro", queueName: "Fila PME", dutyDate: "2026-10-10", startsAt: new Date("2026-10-10T09:00:00-03:00"), endsAt: new Date("2026-10-10T18:00:00-03:00"), paused: false },
      readyToReceive: false,
    } });
    const plantaoUnavailable = buildAssistantThreads({ data: withNextDuty, capabilities: { quoteSimulator: false, dutyCalendar: false }, now }).find((thread) => thread.assistant === "plantao");
    const plantaoAvailable = buildAssistantThreads({ data: withNextDuty, capabilities: { quoteSimulator: false, dutyCalendar: true }, now }).find((thread) => thread.assistant === "plantao");
    expect(plantaoUnavailable).toMatchObject({ preview: "Nenhum plantão agendado." });
    expect(plantaoAvailable?.preview).toContain("Próximo plantão: PME Centro");
  });

  it("sorts assistant threads by waiting, unread, then latest event", () => {
    const data = workspace({
      inbox: [{ id: "notice-1", source: "notification", title: "Escala publicada", description: "Nova escala", href: "/notificacoes", severity: "normal" }],
      queue: [lead()],
      nextAction: priority(),
      duty: { active: activeDuty({ presenceStatus: "pending" }) as NonNullable<NonNullable<BrokerWorkspaceData["duty"]>["active"]>, next: null, readyToReceive: false },
      agenda: [{ id: "return-1", leadId: "lead-2", leadName: "João Reis", title: "Retorno", dueAt: new Date("2026-10-09T12:30:00-03:00"), priority: "normal", href: "/leads/lead-2#tarefas" }],
      updatedAt: new Date("2026-10-09T11:00:00-03:00"),
      goal: { name: "Meta", percentage: 20, currentValue: "2", targetValue: "10" },
      today: { ...workspace().today, unreadNotifications: 1, receivedToday: 1 },
    });
    const threads = buildAssistantThreads({ data, capabilities: { quoteSimulator: false, dutyCalendar: true }, now });
    expect(threads[0]?.assistant).toBe("leads");
    expect(threads[1]?.assistant).toBe("plantao");
    expect(threads[2]).toMatchObject({ assistant: "ancora", unread: true, waitingYou: false });
    expect(threads.findIndex((thread) => thread.assistant === "ancora")).toBeLessThan(threads.findIndex((thread) => thread.assistant === "agenda"));
    expect(threads.findIndex((thread) => thread.assistant === "agenda")).toBeLessThan(threads.findIndex((thread) => thread.assistant === "desempenho"));
  });

  it("builds lead threads from priority and status, with stable ids and waiting states", () => {
    const threads = buildLeadThreads({
      now,
      queue: [
        lead(),
        lead({ id: "lead-2", name: "João Reis", status: "in_contact", nextAction: null }),
      ],
    });
    expect(threads[0]).toMatchObject({
      id: "lead:lead-1",
      kind: "lead",
      leadId: "lead-1",
      initials: "CS",
      href: "/leads/lead-1",
      unread: true,
      waitingYou: true,
    });
    expect(threads[0]?.preview).toContain("Clara Souza");
    expect(threads[1]).toMatchObject({ id: "lead:lead-2", preview: "Atendimento em andamento.", initials: "JR", unread: false, waitingYou: false });
    expectNoEmDash(threads);
  });

  it("offers accept, lead details and a stable decline follow-up for a new lead", () => {
    const data = workspace({ nextAction: priority() });
    const script = buildAssistantScript("leads", { data, now });
    const questions = questionBlocks(script);
    expect(script.blocks[0]).toMatchObject({ type: "date", label: "Hoje, 12:00" });
    expect(script.blocks[1]).toMatchObject({ type: "assistant", text: "Boa tarde, Ana Lima." });
    expect(questions[0]?.choices.map(({ label }) => label)).toEqual(["Aceitar", "Ver a ficha", "Recusar"]);
    expect(questions[0]?.choices[0]?.action).toEqual({ kind: "server", name: "lead.accept", payload: { leadId: "lead-1" } });
    expect(questions[0]?.choices[1]?.action).toEqual({ kind: "href", href: "/leads/lead-1" });
    expect(questions[0]?.choices[2]?.action).toEqual({ kind: "next", questionId: "decline-lead-1" });
    expect(questions[1]?.id).toBe("decline-lead-1");
    expect(questions[1]?.choices.map(({ label }) => label)).toEqual(["Não atendo PME", "Sem horário", "Outro"]);
    expect(questions[1]?.choices[2]?.action).toEqual({ kind: "server", name: "lead.decline", payload: { leadId: "lead-1", reason: "Outro" } });
    expect(script.status).toEqual({ label: "Esperando você", tone: "waiting" });
    expectNoEmDash(script);
  });

  it("builds the SLA risk route and the clear-state list of active leads", () => {
    const risk = buildAssistantScript("leads", {
      data: workspace({ nextAction: priority({ kind: "sla_risk", referenceAt: new Date("2026-10-09T11:30:00-03:00") }) }),
      now,
    });
    expect(risk.blocks.find((block) => block.id === "leads-sla")?.type === "assistant" && (risk.blocks.find((block) => block.id === "leads-sla") as Extract<ChatBlock, { type: "assistant" }>).text).toContain("há 30 min");
    expect(questionBlocks(risk)[0]?.choices.map(({ label }) => label)).toEqual(["Abrir conversa", "Registrar contato"]);
    expect(questionBlocks(risk)[0]?.choices[1]?.action).toEqual({ kind: "server", name: "lead.registerContact", payload: { leadId: "lead-1" } });

    const clear = buildAssistantScript("leads", {
      data: workspace({
        queue: [lead({ status: "in_contact", nextAction: null }), lead({ id: "lead-2", name: "Lia Nunes", status: "negotiation", nextAction: null })],
      }),
      now,
    });
    expect(clear.blocks.find((block) => block.id === "leads-all-clear")).toMatchObject({ type: "assistant", text: "Tudo em dia por aqui." });
    expect(clear.blocks.find((block) => block.id === "leads-in-service")).toMatchObject({ type: "list", items: [{ id: "lead-1" }, { id: "lead-2" }] });
    expect(clear.status?.tone).toBe("idle");
    expectNoEmDash(risk);
    expectNoEmDash(clear);
  });

  it("builds active, paused, pending-presence and future or empty duty scripts", () => {
    const active = buildAssistantScript("plantao", { data: workspace({ duty: { active: activeDuty(), next: null, readyToReceive: true } }), now });
    expect(active.blocks.find((block) => block.type === "facts")).toMatchObject({
      title: "Seu plantão",
      rows: expect.arrayContaining([
        { label: "Plantão", value: "PME Centro" },
        { label: "Horário", value: "09:00 às 18:00" },
        { label: "Fila", value: "Fila PME" },
        { label: "Unidade", value: "Centro" },
      ]),
    });
    expect(questionBlocks(active)[0]?.choices.map(({ label }) => label)).toEqual(["Pausar 15 min", "Pausar até eu voltar", "Ver escala"]);
    expect(questionBlocks(active)[0]?.choices[0]?.action).toEqual({ kind: "server", name: "duty.pause", payload: { minutes: 15 } });
    expect(questionBlocks(active)[0]?.choices[1]?.action).toEqual({ kind: "server", name: "duty.pause", payload: { minutes: null } });
    expect(questionBlocks(active)[0]?.choices[2]?.action).toEqual({ kind: "href", href: "/plantoes" });

    const paused = buildAssistantScript("plantao", { data: workspace({ duty: { active: activeDuty({ paused: true }), next: null, readyToReceive: false } }), now });
    expect(questionBlocks(paused)[0]?.choices[0]?.action).toEqual({ kind: "server", name: "duty.resume", payload: {} });
    expect(paused.status?.tone).toBe("paused");

    const pending = buildAssistantScript("plantao", { data: workspace({ duty: { active: activeDuty({ presenceStatus: "pending" }), next: null, readyToReceive: false } }), now });
    expect(pending.blocks).toContainEqual({ type: "system", id: "duty-presence-schedule-1", text: "Aguardando o gestor liberar sua presença." });
    expect(questionBlocks(pending)).toHaveLength(0);

    const next = buildAssistantScript("plantao", { data: workspace({ duty: { active: null, next: { scheduleName: "PME Centro", queueName: "Fila PME", dutyDate: "2026-10-10", startsAt: new Date("2026-10-10T09:00:00-03:00"), endsAt: new Date("2026-10-10T18:00:00-03:00"), paused: false }, readyToReceive: false } }), now });
    expect(next.blocks[0]).toMatchObject({ type: "facts", title: "Próximo plantão" });
    expect(buildAssistantScript("plantao", { data: workspace(), now }).blocks).toContainEqual({ type: "assistant", id: "duty-empty", text: "Nenhum plantão agendado." });
    expectNoEmDash([active, paused, pending, next]);
  });

  it("lists agenda items in São Paulo time and gives the requested next steps", () => {
    const script = buildAssistantScript("agenda", {
      data: workspace({ agenda: [{ id: "task-1", leadId: "lead-1", leadName: "Clara Souza", title: "Retornar sobre a cotação", dueAt: new Date("2026-10-09T15:30:00-03:00"), priority: "urgent", href: "/leads/lead-1#tarefas" }] }),
      now,
    });
    expect(script.blocks.find((block) => block.type === "list")).toMatchObject({ items: [{ id: "task-1", lead: "Clara Souza", trailing: "15:30" }] });
    expect(questionBlocks(script)[0]?.choices.map(({ label }) => label)).toEqual(["Começar pelo primeiro", "Ver todos"]);
    expect(questionBlocks(script)[0]?.choices[0]?.action).toEqual({ kind: "href", href: "/leads/lead-1#tarefas" });
    expect(questionBlocks(script)[0]?.choices[1]?.action).toEqual({ kind: "href", href: "/minha-fila?aba=retornos" });

    const empty = buildAssistantScript("agenda", { data: workspace(), now });
    expect(empty.blocks).toContainEqual({ type: "assistant", id: "agenda-empty", text: "Sem retornos hoje." });
    expect(script.status?.tone).toBe("waiting");
    expect(empty.status?.tone).toBe("idle");
    expectNoEmDash([script, empty]);
  });

  it("shows performance facts and optional goal details with useful links", () => {
    const script = buildAssistantScript("desempenho", {
      data: workspace({ today: { ...workspace().today, receivedToday: 5, acceptedToday: 3, inServiceNow: 7, slaAtRiskNow: 2 }, goal: { name: "Meta mensal", percentage: 60, currentValue: "6", targetValue: "10" } }),
      now,
    });
    expect(script.blocks).toContainEqual(expect.objectContaining({ type: "facts", id: "performance-today", rows: expect.arrayContaining([{ label: "Recebidos hoje", value: "5" }, { label: "Aceitos hoje", value: "3" }, { label: "Em atendimento", value: "7" }, { label: "SLA em risco", value: "2" }]) }));
    expect(script.blocks).toContainEqual(expect.objectContaining({ type: "facts", id: "performance-goal", rows: expect.arrayContaining([{ label: "Progresso", value: "60%" }, { label: "Atual", value: "6" }, { label: "Meta", value: "10" }]) }));
    expect(questionBlocks(script)[0]?.choices.map(({ label }) => label)).toEqual(["Ver meus leads", "Ver plantões"]);
    expect(questionBlocks(script)[0]?.choices.map(({ action }) => action)).toEqual([
      { kind: "href", href: "/minha-fila" },
      { kind: "href", href: "/plantoes" },
    ]);
    expect(script.status?.tone).toBe("waiting");
    expectNoEmDash(script);

    const withoutGoal = buildAssistantScript("desempenho", { data: workspace(), now });
    expect(withoutGoal.blocks.some((block) => block.id === "performance-goal")).toBe(false);
  });
});
