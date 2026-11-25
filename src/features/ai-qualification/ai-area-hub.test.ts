import { describe, expect, it } from "vitest";

import type { NavAccessUser } from "@/shared/navigation/nav-registry";

import { aiAreaTabs, aiHubTabIds, AI_HUB_TAB_ID, buildAiHubSections, buildAiHubSummary } from "./ai-area-hub";

const director: NavAccessUser = { roleKey: "director", jobTitle: null, permissions: ["acessar_qualificacao_ia", "acessar_ferramentas"] };

describe("hub Atendimento IA", () => {
  it("toda aba da área que não está no topo aparece no hub, uma vez só", () => {
    const hubIds = aiHubTabIds();
    expect(new Set(hubIds).size).toBe(hubIds.length);
    const hubOnly = aiAreaTabs().filter((tab) => tab.hub).map((tab) => tab.id);
    expect(hubOnly.filter((id) => !hubIds.includes(id))).toEqual([]);
    expect(hubIds).not.toContain(AI_HUB_TAB_ID);
    for (const id of hubIds) expect(aiAreaTabs().some((tab) => tab.id === id)).toBe(true);
  });

  it("três seções na ordem Configurar, Ensinar, Acompanhar, com nome e endereço da aba", () => {
    const sections = buildAiHubSections(director, {});
    expect(sections.map((section) => section.title)).toEqual(["Configurar", "Ensinar", "Acompanhar"]);
    expect(sections[0]!.rows.map((row) => row.label)).toEqual(["Prompt e comportamento", "Permissões", "Follow-up", "Fluxo de atendimento", "Fluxos de WhatsApp"]);
    expect(sections[1]!.rows.map((row) => row.label)).toEqual(["Situações", "Mensagens", "Materiais das operadoras"]);
    expect(sections[2]!.rows.map((row) => row.id)).toEqual(["leads-qualificacao", "recuperacao", "turbo", "alertas", "execucoes", "simulador", "conectividade"]);
    expect(sections[2]!.rows.find((row) => row.id === "alertas")?.href).toBe("/ia/alertas");
    for (const row of sections.flatMap((section) => section.rows)) expect(row.description).not.toContain("—");
  });

  it("mostra número só quando faz sentido", () => {
    const rows = buildAiHubSections(director, { activeAlerts: 3, activeQualifications: 1, failures24h: 0 }).flatMap((section) => section.rows);
    expect(rows.find((row) => row.id === "alertas")?.count).toBe("3 alertas");
    expect(rows.find((row) => row.id === "leads-qualificacao")?.count).toBe("1 lead agora");
    expect(rows.find((row) => row.id === "execucoes")?.count).toBeNull();
    expect(rows.find((row) => row.id === "simulador")?.count).toBeNull();
  });

  it("linha que a pessoa não pode abrir some (Materiais e Fluxos são do diretor)", () => {
    const supervisor: NavAccessUser = { ...director, roleKey: "supervisor" };
    const ids = buildAiHubSections(supervisor).flatMap((section) => section.rows.map((row) => row.id));
    expect(ids).not.toContain("base");
    expect(ids).not.toContain("fluxos");
    expect(buildAiHubSections(null)).toEqual([]);
  });

  it("resumo vivo: IA ligada ou pausada, números e indisponível quando a leitura falha", () => {
    const on = buildAiHubSummary({ enabled: true, activeQualifications: 4, activeAlerts: 2, failures24h: 1 });
    expect(on.map((item) => [item.label, item.value])).toEqual([["IA", "Ligada"], ["Em qualificação agora", "4"], ["Alertas ativos", "2"], ["Falhas em 24 h", "1"]]);
    expect(on.find((item) => item.id === "failures")?.href).toBe("/ia/execucoes?falhas=1");
    const off = buildAiHubSummary({ enabled: false, activeQualifications: null, activeAlerts: 0, failures24h: 0 });
    expect(off[0]).toMatchObject({ value: "Pausada", tone: "warning" });
    expect(off[1]!.value).toBe("Indisponível");
    expect(off[2]!.tone).toBeUndefined();
  });
});
