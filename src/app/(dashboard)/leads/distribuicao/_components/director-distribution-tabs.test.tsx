import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectorDistributionTabs } from "./director-distribution-tabs";

describe("navegação Lite da distribuição", () => {
  it("mantém filtros da URL e identifica a aba ativa sem conteúdo cliente", () => {
    const html = renderToStaticMarkup(
      <DirectorDistributionTabs
        activeView="roteamento"
        showQueues
        status="queued"
        escalaMes="2026-10"
      />,
    );

    expect(html).toContain('aria-label="Áreas da distribuição"');
    expect(html).toContain('aria-current="page" href="/distribuicao?view=roteamento&amp;status=queued&amp;escalaMes=2026-10"');
    expect(html).toContain("Filas");
    expect(html).not.toContain("<button");
  });

  it("oculta Filas para papéis sem acesso", () => {
    const html = renderToStaticMarkup(
      <DirectorDistributionTabs activeView="resumo_dia" showQueues={false} />,
    );

    expect(html).not.toContain("Filas");
  });
});
