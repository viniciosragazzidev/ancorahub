import { describe, expect, it } from "vitest";

import { resolveEffectiveAccess } from "@/features/custom-roles/effective-access";

import { agentAccessAllowed, agentOffSettingKey, parseAgentOffList, withAgentAccess } from "./access-rules";

describe("quem usa o Agente IA", () => {
  const base = { role: "director", outsideManagerScope: false, hasCapability: true, offForUser: false };

  it("diretor sem cargo usa; gestor, supervisor e corretor não", () => {
    expect(agentAccessAllowed(base)).toBe(true);
    for (const role of ["manager", "supervisor", "broker"]) expect(agentAccessAllowed({ ...base, role })).toBe(false);
  });

  it("desligado na ficha não usa", () => {
    expect(agentAccessAllowed({ ...base, offForUser: true })).toBe(false);
  });

  it("cargo sem \"Agente IA\" corta; cargo com libera; sem cargo vale o papel", () => {
    const semCargo = resolveEffectiveAccess({ role: "director", cargo: null });
    expect(semCargo.capabilities.has("usar_agente_ia")).toBe(true);
    const cargoSem = resolveEffectiveAccess({ role: "director", cargo: { status: "active", permissions: ["route:plantoes", "acessar_leads"] } });
    expect(cargoSem.capabilities.has("usar_agente_ia")).toBe(false);
    const cargoCom = resolveEffectiveAccess({ role: "director", cargo: { status: "active", permissions: ["usar_agente_ia"] } });
    expect(cargoCom.capabilities.has("usar_agente_ia")).toBe(true);
    // O cargo nunca dá o que o papel não tem.
    const gestor = resolveEffectiveAccess({ role: "manager", cargo: { status: "active", permissions: ["usar_agente_ia"] } });
    expect(gestor.capabilities.has("usar_agente_ia")).toBe(false);
  });

  it("lista de desligados: liga, desliga, sem repetir, e lida com valor estragado", () => {
    expect(agentOffSettingKey("t1")).toBe("agent_ia_off_users_t1");
    expect(parseAgentOffList(null)).toEqual([]);
    expect(parseAgentOffList("isso não é json")).toEqual([]);
    expect(parseAgentOffList('["a", 3, "b"]')).toEqual(["a", "b"]);
    expect(withAgentAccess(["a"], "b", false)).toEqual(["a", "b"]);
    expect(withAgentAccess(["a", "b"], "b", false)).toEqual(["a", "b"]);
    expect(withAgentAccess(["a", "b"], "a", true)).toEqual(["b"]);
  });
});
