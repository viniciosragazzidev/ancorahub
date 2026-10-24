import { describe, expect, it } from "vitest";

import { formatLiteSkinReport, groupLiteSkinFile, scanLiteSkinSource } from "./check-lite-skin.mjs";

describe("auditoria report-only do skin Lite", () => {
  it("conta classes e imports conhecidos em um arquivo de exemplo", () => {
    const result = scanLiteSkinSource("src/app/(dashboard)/leads/page.tsx", `
      <div className="bg-gradient-to-r from-blue-500 shadow-lg dark:bg-zinc-900 uppercase tracking-wide text-[13px] h-8 font-light" />
      import { Button } from "@/components/ui/button";
      import { AreaChart } from "recharts";
    `);

    expect(result.counts).toMatchObject({ gradients: 2, shadows: 1, darkClasses: 1, uppercase: 1, wideTracking: 1, rawColors: 1, arbitraryValues: 1, smallTargets: 1, forbiddenWeights: 1, charts: 1, emDashText: 0 });
    expect(result.uiImports).toEqual(["button"]);
  });

  it("formata inventário como relatório, sem resultado bloqueante", () => {
    const report = {
      filesScanned: 1,
      totals: { gradients: 1 },
      topFiles: [{ file: "src/app/(dashboard)/leads/page.tsx", total: 1 }],
      groups: [{ name: "rota:/leads", deviations: 1, files: 1 }],
      uiUsage: [{ component: "button", files: 1 }],
    };
    expect(formatLiteSkinReport(report)).toContain("Auditoria de estilo Lite, modo relatório");
    expect(formatLiteSkinReport(report)).toContain("rota:/leads: 1 ocorrências em 1 arquivos");
  });

  it("agrupa páginas, features e componentes pela pasta responsável", () => {
    expect(groupLiteSkinFile("src/app/(dashboard)/leads/page.tsx")).toBe("rota:/leads");
    expect(groupLiteSkinFile("src/app/(dashboard)/leads/[id]/page.tsx")).toBe("rota:/leads/[id]");
    expect(groupLiteSkinFile("src/features/dashboard/components/card.tsx")).toBe("feature:dashboard");
    expect(groupLiteSkinFile("src/components/ui/button.tsx")).toBe("componente:ui");
  });
});

describe("tokens e bibliotecas aprovadas não são desvio", () => {
  it("não conta --shadow-resting nem lucide-react nem @/components/arc como desvio", () => {
    const result = scanLiteSkinSource("src/features/dashboard/components/director-lite/card.tsx", `
      import { Users } from "lucide-react";
      import { motionTokens } from "@/components/arc/motion-tokens";
      <div className="rounded-xl" style={{ boxShadow: "var(--shadow-resting)" }} />
    `);

    expect(result.counts.shadows).toBe(0);
    expect(result.counts.icons).toBe(0);
    expect(result.counts.arcImports).toBe(1);
    expect(result.total).toBe(0);
  });

  it("não conta box-shadow que usa só um token da escala", () => {
    const result = scanLiteSkinSource("src/features/x/card.module.css", ".card { box-shadow: var(--shadow-resting); }");
    expect(result.counts.shadows).toBe(0);
  });

  it("continua contando sombra fora do token", () => {
    const result = scanLiteSkinSource("src/features/x/card.tsx", `<div className="shadow-lg" />`);
    expect(result.counts.shadows).toBe(1);
    expect(result.total).toBe(1);
  });
});
