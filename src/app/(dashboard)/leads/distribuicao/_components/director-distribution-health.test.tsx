import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectorDistributionHealth } from "./director-distribution-health";

describe("saúde Lite da distribuição", () => {
  it("mostra automação, efeitos e histórico com datas de São Paulo", () => {
    const html = renderToStaticMarkup(<DirectorDistributionHealth
      events={[{ id: "event-1", leadName: "Mariana Costa", brokerName: "Ana Souza", queueName: "Fila Premium", action: "lead_assigned", reason: "Aceite manual", createdAt: "2026-10-25T15:00:00.000Z" }]}
      jobs={{ pending: 2, retrying: 1, processing: 1, failed: 0, completed: 8 }}
      jobsAvailable
      jobsEnabled
      effects={{ pending: 0, retrying: 0, processing: 0, failed: 1, completed: 8 }}
      failedEffects={[{ id: "effect-1", leadName: "Mariana Costa", type: "assignment", attemptCount: 2, lastErrorCode: "timeout", lastErrorMessage: "Repetir envio" }]}
    />);

    expect(html).toContain("Histórico de decisões");
    expect(html).toContain("Automação da fila");
    expect(html).toContain("Efeitos de entrada");
    expect(html).toContain("Requer revisão");
    expect(html).toContain("Repetir envio");
    expect(html).toContain("Lead atribuído");
    expect(html).toContain("25/10/2026, 12:00");
  });

  it("explica o estado vazio do histórico", () => {
    const html = renderToStaticMarkup(<DirectorDistributionHealth
      events={[]}
      jobs={{ pending: 0, retrying: 0, processing: 0, failed: 0, completed: 0 }}
      jobsAvailable={false}
      jobsEnabled={false}
      effects={{ pending: 0, retrying: 0, processing: 0, failed: 0, completed: 0 }}
      failedEffects={[]}
    />);

    expect(html).toContain("Ainda não há eventos neste escopo.");
    expect(html).toContain("Aguardando configuração");
  });
});
