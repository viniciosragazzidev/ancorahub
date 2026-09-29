import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("sales navigation performance contract", () => {
  const root = process.cwd();

  it("prefetches the sales route from the primary sidebar", () => {
    const sidebar = readFileSync(join(root, "src/components/corretop-sidebar.tsx"), "utf8");
    expect(sidebar).toMatch(/priorityNavigationPaths[^\n]+["']\/vendas["']/);
  });

  it("shows immediate route feedback while dynamic sales data loads", () => {
    expect(existsSync(join(root, "src/app/(dashboard)/vendas/loading.tsx"))).toBe(true);
  });

  it("does not query the same sales population twice to calculate revenue", () => {
    const page = readFileSync(join(root, "src/app/(dashboard)/vendas/page.tsx"), "utf8");
    expect(page.match(/\.from\(schema\.sales\)/g)).toHaveLength(1);
  });
});
