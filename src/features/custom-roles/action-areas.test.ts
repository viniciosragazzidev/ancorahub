import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { canAccessRoute, resolveEffectiveAccess } from "./effective-access";
import { normalizarArquivoDaAcao, requisitoDaAcao } from "./action-areas";
import { routeCatalog, routePermissionKey } from "./routes";

function arquivosComAcoes(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosComAcoes(caminho);
    if (!/\.(ts|tsx)$/.test(nome) || /\.test\./.test(nome)) return [];
    return /^\s*["']use server["']/.test(readFileSync(caminho, "utf8")) ? [relative(process.cwd(), caminho).split("\\").join("/")] : [];
  });
}

describe("áreas das ações de servidor (fronteira dos cargos)", () => {
  it("todo arquivo de ação tem regra (arquivo novo sem regra fica negado para quem tem cargo)", () => {
    const semRegra = arquivosComAcoes(join(process.cwd(), "src")).filter((arquivo) => requisitoDaAcao(arquivo).kind === "negado");
    expect(semRegra).toEqual([]);
  });

  it("normaliza o caminho do manifesto do Windows e do Linux", () => {
    const windows = ["..", "C:", "Users", "x", "ancorahub", "src", "features", "leads", "actions.ts"].join(String.fromCharCode(92));
    expect(normalizarArquivoDaAcao(windows)).toBe("src/features/leads/actions.ts");
    expect(normalizarArquivoDaAcao("/app/src/features/leads/actions.ts")).toBe("src/features/leads/actions.ts");
    expect(requisitoDaAcao(undefined).kind).toBe("negado");
    expect(requisitoDaAcao("/app/src/features/desconhecida/x.ts").kind).toBe("negado");
  });

  it("Plantões (diretor + cargo): leads, distribuição, conversas e equipe sim; marca, vendas e metas não", () => {
    const rotas = ["leads", "conversas", "equipe", "distribuicao", "plantoes", "minha-fila", "tarefas", "notificacoes"].map(routePermissionKey);
    const access = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: [...rotas, "acessar_leads", "leads_assign"] } });
    const pode = (arquivo: string) => {
      const requisito = requisitoDaAcao(arquivo);
      if (requisito.kind === "livre") return true;
      if (requisito.kind === "cap") return access.capabilities.has(requisito.permission);
      if (requisito.kind === "route") return canAccessRoute(access, routeCatalog.find((route) => route.key === requisito.key));
      return false;
    };
    expect(pode("src/features/leads/actions.ts")).toBe(true);
    expect(pode("src/features/lead-distribution/duty-actions.ts")).toBe(true);
    expect(pode("src/features/conversations/actions.ts")).toBe(true);
    expect(pode("src/app/(dashboard)/equipe/actions.ts")).toBe(true);
    expect(pode("src/features/user-profile/actions.ts")).toBe(true);
    expect(pode("src/app/(dashboard)/settings/actions.ts")).toBe(false);
    expect(pode("src/features/sales/actions.ts")).toBe(false);
    expect(pode("src/features/goals/actions.ts")).toBe(false);
    expect(pode("src/features/meta-ads/actions.ts")).toBe(false);
  });
});
