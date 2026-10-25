import { describe, expect, it } from "vitest";

import { liteDashboardTabs } from "./director-lite-tabs";

describe("abas do painel Lite por papel", () => {
  it("segue as regras de hoje: Qualidade com a central, Funil só para diretor ou gestor com unidade", () => {
    expect(liteDashboardTabs({ role: "director", branchId: null }, true)).toEqual(["overview", "quality", "funnel"]);
    expect(liteDashboardTabs({ role: "manager", branchId: "b1" }, true)).toEqual(["overview", "quality", "funnel"]);
    expect(liteDashboardTabs({ role: "manager", branchId: null }, true)).toEqual(["overview", "quality"]);
    expect(liteDashboardTabs({ role: "manager", branchId: "b1" }, false)).toEqual(["overview"]);
    expect(liteDashboardTabs({ role: "broker", branchId: null }, false)).toEqual(["overview"]);
  });
});
