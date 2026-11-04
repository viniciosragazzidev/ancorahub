import { describe, expect, it } from "vitest";

import { resolveEffectiveAccess } from "@/features/custom-roles/effective-access";

import { resolveDistributionView, visibleDistributionViews } from "./distribution-view-access";

const plantoes = resolveEffectiveAccess({
  role: "director",
  jobTitle: "director",
  cargo: {
    status: "active",
    permissions: ["lead_queues_view", "lead_queues_manage", "duty_schedules_manage", "leads_assign", "leads_reassign", "distribution_audit_view"],
  },
});

describe("abas da Distribuição com cargo (F2)", () => {
  it("sem cargo nada muda", () => {
    expect(visibleDistributionViews("director")).toContain("roteamento");
    expect(visibleDistributionViews("manager")).not.toContain("filas");
  });

  it("Plantões (diretor + cargo) vê Filas e Plantões, sem Entradas e regras", () => {
    const views = visibleDistributionViews("director", plantoes.capabilities);
    expect(views).toEqual(["resumo_dia", "filas", "operar", "plantao", "saude_historico"]);
    expect(resolveDistributionView("director", "roteamento", plantoes.capabilities)).toBe("resumo_dia");
    expect(resolveDistributionView("director", "filas", plantoes.capabilities)).toBe("filas");
  });

  it("cargo sem nenhuma aba devolve null (a página nega)", () => {
    const nada = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: [] } });
    expect(resolveDistributionView("director", undefined, nada.capabilities)).toBeNull();
  });

  it("cargo sem o Resumo cai na primeira aba liberada", () => {
    const soPlantao = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: ["duty_schedules_manage"] } });
    expect(resolveDistributionView("director", undefined, soPlantao.capabilities)).toBe("plantao");
  });
});
