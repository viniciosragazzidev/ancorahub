import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectorDistributionDashboard } from "./director-distribution-dashboard";

describe("dashboard Lite de distribuição", () => {
  it("mantém os indicadores existentes em pt-BR e abre a central", () => {
    const html = renderToStaticMarkup(<DirectorDistributionDashboard data={{
      title: "Visão de distribuição",
      description: "Fluxo de leads no período.",
      metrics: [{ label: "Recebidos", value: 1234 }, { label: "Atribuídos", value: 987 }],
      actionHref: "/distribuicao",
    }} />);

    expect(html).toContain("1.234");
    expect(html).toContain("987");
    expect(html).toContain('href="/distribuicao?view=resumo_dia"');
  });
});
