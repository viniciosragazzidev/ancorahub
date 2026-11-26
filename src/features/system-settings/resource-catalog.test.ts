import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import {
  BROKER_NEWS_RESOURCES,
  buildResourceEntries,
  flagIsOn,
  groupResources,
  resourceSettingKeys,
  resourceStateLabel,
  tenantFlagKey,
  TENANT_FLAG_RESOURCES,
} from "./resource-catalog";

const company = { feedbackToastEnabled: true, feedbackPushEnabled: false, feedbackRequiredEnabled: true };

describe("flagIsOn", () => {
  it("usa o padrão quando não há valor salvo e aceita outros valores de ligado", () => {
    expect(flagIsOn(undefined, "true")).toBe(true);
    expect(flagIsOn("false", "true")).toBe(false);
    expect(flagIsOn("observe", "off", ["observe"])).toBe(true);
    expect(flagIsOn(undefined, "off", ["observe"])).toBe(false);
  });
});

describe("buildResourceEntries", () => {
  it("lê as flags globais, as da empresa pela chave com o id e os ajustes do diretor", () => {
    const settings = new Map([
      [FEATURE_FLAGS.BROKER_NOW_FLOATING.key, "false"],
      [tenantFlagKey(FEATURE_FLAGS.CUSTOMER_WAITING_GUARD, "t1"), "observe"],
      [tenantFlagKey(FEATURE_FLAGS.AUTO_SALE, "t2"), "true"],
      ["ai_stage_mode_t1", "off"],
    ]);
    const entries = buildResourceEntries({ tenantId: "t1", settings, company, units: [] });
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    expect(byId.get("brokerNowFloatingEnabled")).toMatchObject({ group: "plataforma", decidedBy: "Plataforma", enabled: false });
    expect(byId.get("customer-waiting-guard")).toMatchObject({ group: "empresa", decidedBy: "Plataforma", enabled: true });
    // Ligado para outra empresa não vale aqui.
    expect(byId.get("auto-sale")?.enabled).toBe(false);
    expect(byId.get("ai-stage-mode")).toMatchObject({ decidedBy: "Diretor", enabled: false, adjustHref: "/settings?tab=atendimento" });
    expect(byId.get("feedback-push")?.enabled).toBe(false);
    expect(entries).toHaveLength(BROKER_NEWS_RESOURCES.length + TENANT_FLAG_RESOURCES.length + 4);
  });

  it("nunca leva valor salvo nem chave para a tela, só a situação", () => {
    const settings = new Map(resourceSettingKeys("t1").map((key) => [key, "segredo-123"]));
    const entries = buildResourceEntries({ tenantId: "t1", settings, company: null, units: [] });
    const text = JSON.stringify(entries);
    expect(text).not.toContain("segredo-123");
    expect(text).not.toContain("t1");
    expect(text).not.toContain("feature_");
    for (const entry of entries) expect(typeof entry.enabled).toBe("boolean");
  });

  it("cria dois recursos por unidade, com o nome da unidade", () => {
    const entries = buildResourceEntries({ tenantId: "t1", settings: new Map(), company, units: [{ id: "b1", name: "Centro", acceptingLeads: true, autoDistribute: false }] });
    expect(entries.filter((entry) => entry.group === "unidade")).toEqual([
      expect.objectContaining({ id: "unit-b1-accepting", unitName: "Centro", enabled: true, decidedBy: "Diretor" }),
      expect.objectContaining({ id: "unit-b1-auto", unitName: "Centro", enabled: false }),
    ]);
  });
});

describe("groupResources", () => {
  const entries = buildResourceEntries({ tenantId: "t1", settings: new Map(), company, units: [] });

  it("agrupa na ordem fixa, sem grupo vazio, com o que o diretor decide primeiro", () => {
    const groups = groupResources(entries, { canAdjust: true });
    expect(groups.map((group) => group.title)).toEqual(["Da plataforma", "Da empresa"]);
    const empresa = groups[1]!.items;
    expect(empresa.slice(0, 4).every((item) => item.decidedBy === "Diretor")).toBe(true);
    expect(empresa.slice(4).every((item) => item.decidedBy === "Plataforma")).toBe(true);
    expect(empresa.filter((item) => item.adjustHref)).toHaveLength(4);
  });

  it("sem permissão de ajuste (gestor), nenhum Ajustar", () => {
    const groups = groupResources(entries, { canAdjust: false });
    expect(groups.flatMap((group) => group.items).some((item) => "adjustHref" in item)).toBe(false);
  });

  it("mostra Por unidade só quando há unidade", () => {
    const withUnit = buildResourceEntries({ tenantId: "t1", settings: new Map(), company: null, units: [{ id: "b1", name: "Centro", acceptingLeads: true, autoDistribute: true }] });
    expect(groupResources(withUnit, { canAdjust: true }).map((group) => group.id)).toEqual(["plataforma", "empresa", "unidade"]);
  });

  it("situação sempre em texto", () => {
    expect(resourceStateLabel(true)).toBe("Ligado");
    expect(resourceStateLabel(false)).toBe("Desligado");
  });
});

describe("textos do catálogo", () => {
  it("sem travessão", () => {
    for (const item of [...BROKER_NEWS_RESOURCES, ...TENANT_FLAG_RESOURCES]) {
      expect(`${item.title} ${item.detail}`).not.toContain("—");
    }
  });
});
