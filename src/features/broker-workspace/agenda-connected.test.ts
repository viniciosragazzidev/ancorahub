import { describe, expect, it } from "vitest";

import {
  agendaDestination,
  agendaDutyLine,
  agendaGroupOf,
  classifyAgendaKind,
  formatAgendaEntryWhen,
  groupAgendaEntries,
  type AgendaEntry,
} from "./agenda-connected";

// 13/11/2026 10:00 em São Paulo (UTC-3).
const NOW = new Date("2026-11-13T13:00:00Z");

function entry(id: string, dueAt: string | null, extra: Partial<AgendaEntry> = {}): AgendaEntry {
  return { id, leadId: `lead-${id}`, leadName: `Cliente ${id}`, title: "Retornar contato", dueAt: dueAt ? new Date(dueAt) : null, priority: "normal", kind: "retorno", clientId: null, ...extra };
}

describe("agrupamento da Agenda conectada", () => {
  it("separa atrasados, hoje, amanhã, próximos e sem prazo pelo dia de São Paulo", () => {
    expect(agendaGroupOf(new Date("2026-11-13T12:59:00Z"), NOW)).toBe("atrasados");
    expect(agendaGroupOf(new Date("2026-11-12T20:00:00Z"), NOW)).toBe("atrasados");
    expect(agendaGroupOf(new Date("2026-11-13T13:00:00Z"), NOW)).toBe("hoje");
    // 23:30 de hoje em São Paulo já é amanhã em UTC.
    expect(agendaGroupOf(new Date("2026-11-14T02:30:00Z"), NOW)).toBe("hoje");
    expect(agendaGroupOf(new Date("2026-11-14T03:00:00Z"), NOW)).toBe("amanha");
    expect(agendaGroupOf(new Date("2026-11-15T02:59:00Z"), NOW)).toBe("amanha");
    expect(agendaGroupOf(new Date("2026-11-15T03:00:00Z"), NOW)).toBe("proximos");
    expect(agendaGroupOf(null, NOW)).toBe("sem_prazo");
  });

  it("devolve só os grupos com itens, na ordem de leitura, do prazo mais antigo ao mais novo", () => {
    const groups = groupAgendaEntries([
      entry("sem", null),
      entry("prox", "2026-11-20T12:00:00Z"),
      entry("hoje-tarde", "2026-11-13T19:00:00Z"),
      entry("atraso-novo", "2026-11-13T11:00:00Z"),
      entry("hoje-cedo", "2026-11-13T14:00:00Z"),
      entry("atraso-velho", "2026-11-10T11:00:00Z"),
    ], NOW);
    expect(groups.map((group) => group.label)).toEqual(["Atrasados", "Hoje", "Próximos", "Sem prazo"]);
    expect(groups[0].entries.map((item) => item.id)).toEqual(["atraso-velho", "atraso-novo"]);
    expect(groups[1].entries.map((item) => item.id)).toEqual(["hoje-cedo", "hoje-tarde"]);
  });

  it("sem itens não há grupo", () => {
    expect(groupAgendaEntries([], NOW)).toEqual([]);
  });

  it("aceita datas serializadas como texto (vindas do servidor)", () => {
    const serialized = { ...entry("a", null), dueAt: "2026-11-14T12:00:00Z" as unknown as Date };
    expect(groupAgendaEntries([serialized], NOW)[0].key).toBe("amanha");
  });
});

describe("destino de cada item", () => {
  it("abre a conversa do lead quando não há cliente acessível", () => {
    expect(agendaDestination({ leadId: "l1", leadName: "Ana", clientId: null })).toEqual({ href: "/leads/l1", label: "Abrir lead Ana", secondary: null });
  });

  it("abre o perfil quando há cliente vinculado e mantém a conversa a um toque", () => {
    expect(agendaDestination({ leadId: "l1", leadName: "Ana", clientId: "c9" })).toEqual({
      href: "/clientes/c9",
      label: "Abrir perfil de Ana",
      secondary: { href: "/leads/l1", label: "Conversa" },
    });
  });
});

describe("tipo do item", () => {
  it("renovação só pelo vínculo com o lembrete, retorno pelo título gravado, o resto é tarefa", () => {
    expect(classifyAgendaKind("Renovação de Contrato — Ana (30 dias)", true)).toBe("renovacao");
    expect(classifyAgendaKind("Renovação de Contrato — Ana (30 dias)", false)).toBe("tarefa");
    expect(classifyAgendaKind("Retornar contato hoje", false)).toBe("retorno");
    expect(classifyAgendaKind("Retorno", false)).toBe("retorno");
    expect(classifyAgendaKind("Enviar documentos", false)).toBe("tarefa");
  });
});

describe("horário e plantão do dia", () => {
  it("mostra só a hora em Hoje e Amanhã e o dia nos demais grupos", () => {
    expect(formatAgendaEntryWhen(new Date("2026-11-13T17:30:00Z"), "hoje", NOW)).toBe("14:30");
    expect(formatAgendaEntryWhen(new Date("2026-11-13T11:00:00Z"), "atrasados", NOW)).toBe("Hoje, 08:00");
    expect(formatAgendaEntryWhen(new Date("2026-11-12T20:00:00Z"), "atrasados", NOW)).toBe("Ontem, 17:00");
    expect(formatAgendaEntryWhen(new Date("2026-11-20T12:00:00Z"), "proximos", NOW)).toMatch(/20\/11, 09:00$/);
    expect(formatAgendaEntryWhen(null, "sem_prazo", NOW)).toBeNull();
  });

  it("descreve o plantão em andamento ou o de hoje e ignora o de outro dia", () => {
    const active = { scheduleName: "PME", startsAt: new Date("2026-11-13T11:00:00Z"), endsAt: new Date("2026-11-13T21:00:00Z") };
    expect(agendaDutyLine({ active, next: null }, NOW)).toEqual({ state: "em_andamento", title: "PME", detail: "Em andamento até 18:00" });
    const laterToday = { scheduleName: "Noite", dutyDate: "2026-11-13", startsAt: new Date("2026-11-13T21:00:00Z"), endsAt: new Date("2026-11-14T01:00:00Z") };
    expect(agendaDutyLine({ active: null, next: laterToday }, NOW)).toEqual({ state: "hoje", title: "Noite", detail: "Hoje, das 18:00 às 22:00" });
    const tomorrow = { ...laterToday, dutyDate: "2026-11-14", startsAt: new Date("2026-11-14T12:00:00Z") };
    expect(agendaDutyLine({ active: null, next: tomorrow }, NOW)).toBeNull();
    expect(agendaDutyLine(null, NOW)).toBeNull();
  });
});
