import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectorDutyHistoryDistributions } from "./director-duty-history-distributions";

describe("distribuições do histórico de plantão", () => {
  it("mostra uma tabela responsiva com data em São Paulo", () => {
    const html = renderToStaticMarkup(<DirectorDutyHistoryDistributions rows={[{
      id: "distribution-1",
      leadName: "Mariana de Albuquerque Costa",
      brokerName: "Ana Souza",
      assignedAt: "2026-10-25T15:00:00.000Z",
      kind: "Atribuição manual",
      exact: true,
    }]} />);

    expect(html).toContain('data-lite="table"');
    expect(html).toContain('data-lite="list"');
    expect(html).toContain("Mariana de Albuquerque Costa");
    expect(html).toContain("25/10/2026, 12:00");
    expect(html).toContain("Confirmado");
  });
});
