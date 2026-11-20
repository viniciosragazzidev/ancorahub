import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("sales navigation performance contract", () => {
  const root = process.cwd();

  // Desde abe08f49 (perf nav) todo link do menu usa o prefetch padrão do Next (inclusive /vendas), em vez de
  // uma lista fixa de rotas; o contrato agora é nenhum link do menu desligar o prefetch.
  it("keeps the default prefetch on the sidebar links (sales included)", () => {
    const sidebar = readFileSync(join(root, "src/components/corretop-sidebar.tsx"), "utf8");
    expect(sidebar).not.toMatch(/prefetch=\{false\}/);
  });

  it("shows immediate route feedback while dynamic sales data loads", () => {
    expect(existsSync(join(root, "src/app/(dashboard)/vendas/loading.tsx"))).toBe(true);
  });

  it("does not query the same sales population twice to calculate revenue", () => {
    const page = readFileSync(join(root, "src/app/(dashboard)/vendas/page.tsx"), "utf8");
    expect(page.match(/\.from\(schema\.sales\)/g)).toHaveLength(1);
  });
});
