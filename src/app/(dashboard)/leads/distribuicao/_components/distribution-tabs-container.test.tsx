import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DistributionTabsContainer } from "./distribution-tabs-container";

describe("abas antigas da distribuição", () => {
  it("preserva o HTML original quando a chave do diretor está desligada", () => {
    const html = renderToStaticMarkup(
      <DistributionTabsContainer
        initialView="resumo_dia"
        roteamentoContent={<p>Regras</p>}
        resumoDiaContent={<p>Resumo</p>}
        filasContent={<p>Filas</p>}
        operarContent={<p>Operação</p>}
        plantaoContent={<p>Plantões</p>}
        saudeHistoricoContent={<p>Saúde</p>}
        showQueueDefinition
      />,
    );

    expect(html).toMatchSnapshot();
  });
});
