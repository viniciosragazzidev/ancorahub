import { describe, expect, it } from "vitest";

import type { NavAccessUser } from "./nav-registry";
import { normalizeSearchText, searchNavPages } from "./nav-search";
import { describeNavCount, formatNavCount, sumNavCounts } from "./nav-counters";

const director: NavAccessUser = {
  roleKey: "director",
  jobTitle: null,
  permissions: ["acessar_dashboard", "acessar_conversas", "acessar_leads", "acessar_qualificacao_ia", "acessar_vendas", "acessar_clientes", "acessar_documentos", "ver_comissionamento", "acessar_ferramentas", "convidar_corretor", "acessar_campanhas_meta", "importar_leads_meta", "acessar_configuracoes_pessoais", "acessar_integracao_meta", "ver_dashboard_equipe"],
  relationshipCenterEnabled: true,
  negotiationsEnabled: true,
};

describe("busca de páginas do menu", () => {
  it("ignora acento e caixa", () => {
    expect(normalizeSearchText("  Comissões ")).toBe("comissoes");
  });

  it("acha a aba pelo nome sem acento e aponta para o mesmo destino do menu", () => {
    const pages = searchNavPages("comissoes", director);
    expect(pages[0]).toEqual({ id: "comercial:comissoes", title: "Comercial: Comissões", subtitle: "Regras de comissão por operadora e plano", href: "/settings?tab=comissoes" });
  });

  it("exige todas as palavras e põe primeiro quem bate no nome da aba", () => {
    const pages = searchNavPages("plantoes", director);
    expect(pages[0]?.id).toBe("distribuicao:plantoes");
    expect(searchNavPages("distribuicao filas", director).map((page) => page.id)).toEqual(["distribuicao:filas"]);
  });

  it("não mostra o que o usuário não enxerga no menu", () => {
    const broker: NavAccessUser = { ...director, roleKey: "broker" };
    expect(searchNavPages("filas", broker)).toEqual([]);
    expect(searchNavPages("filas", null)).toEqual([]);
    expect(searchNavPages("   ", director)).toEqual([]);
  });
});

describe("contadores do menu", () => {
  it("some no zero e corta em 99+", () => {
    expect(formatNavCount(0)).toBeNull();
    expect(formatNavCount(undefined)).toBeNull();
    expect(formatNavCount(7)).toBe("7");
    expect(formatNavCount(140)).toBe("99+");
  });

  it("diz o que conta, no singular e no plural", () => {
    expect(describeNavCount("distribuicao", 1)).toBe("1 lead esperando corretor");
    expect(describeNavCount("leads", 3)).toBe("3 leads sem primeiro contato");
    expect(describeNavCount("equipe", 3)).toBeNull();
  });

  it("soma as áreas do grupo", () => {
    expect(sumNavCounts({ leads: 2, distribuicao: 5 }, ["leads", "distribuicao"])).toBe(7);
  });
});
