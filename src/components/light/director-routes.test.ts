import { describe, expect, it } from "vitest";

import { resolveDirectorRoute } from "./director-routes";

describe("resolveDirectorRoute", () => {
  it("usa o pai seguro para detalhes sem mudar a URL", () => {
    expect(resolveDirectorRoute("/leads/lead-42")).toEqual({ title: "Lead", parentHref: "/leads" });
    expect(resolveDirectorRoute("/clientes/cliente-3")).toEqual({ title: "Cliente", parentHref: "/clientes" });
    expect(resolveDirectorRoute("/unidades/branch-7")).toEqual({ title: "Unidade", parentHref: "/equipe?visao=unidades" });
  });

  it("mantém telas raiz no menu e remove query da resolução", () => {
    expect(resolveDirectorRoute("/dashboard?tab=quality")).toEqual({ title: "Início", parentHref: null });
    expect(resolveDirectorRoute("/equipe")).toEqual({ title: "Equipe", parentHref: null });
  });

  it("faz a volta de feedback para o lead de origem", () => {
    expect(resolveDirectorRoute("/leads/lead-42/feedback")).toEqual({
      title: "Atualização do lead",
      parentHref: "/leads/lead-42",
    });
  });

  it("distingue rotas de detalhe das rotas secundárias da equipe", () => {
    expect(resolveDirectorRoute("/equipe/cargos")).toEqual({ title: "Cargos", parentHref: "/equipe" });
    expect(resolveDirectorRoute("/equipe/plantao")).toEqual({ title: "Plantão da equipe", parentHref: "/equipe" });
    expect(resolveDirectorRoute("/equipe/corretor-8")).toEqual({ title: "Perfil do corretor", parentHref: "/equipe" });
    expect(resolveDirectorRoute("/leads/distribuicao/plantao/agenda-2")).toEqual({ title: "Plantão", parentHref: "/distribuicao?view=plantao" });
    expect(resolveDirectorRoute("/plantoes/corretor/corretor-8")).toEqual({ title: "Plantão do corretor", parentHref: "/plantoes" });
  });

  it("usa sentence case em títulos de rotas sem mapeamento específico", () => {
    expect(resolveDirectorRoute("/clientes/hoje-e-retornos")).toEqual({ title: "Cliente", parentHref: "/clientes" });
    expect(resolveDirectorRoute("/rota-detalhe-extra")).toEqual({ title: "Rota detalhe extra", parentHref: null });
  });

  it("nomeia rotas principais sem transformar abas em telas de detalhe", () => {
    expect(resolveDirectorRoute("/qualificacao")).toEqual({ title: "Qualificação", parentHref: null });
    expect(resolveDirectorRoute("/plantoes/agora")).toEqual({ title: "Plantões", parentHref: null });
    expect(resolveDirectorRoute("/dashboard/drill/lead")).toEqual({ title: "Detalhe do painel", parentHref: "/dashboard" });
  });
});
