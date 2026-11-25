import { describe, expect, it } from "vitest";

import { AI_FAILURE_ALERT_MIN, buildLiveAlerts } from "./live-alerts-rules";

const quiet = { waitingLeads: 0, oldestWaitingSince: null, aiFailures: 0, lastAiError: null, lastAiFailureAt: null };

describe("alertas calculados na hora", () => {
  it("sem problema, nenhum alerta (nunca há alerta de exemplo)", () => {
    expect(buildLiveAlerts("t1", quiet)).toEqual([]);
  });

  it("lead sem corretor vira alerta com o que fazer e onde", () => {
    const since = new Date("2026-11-25T10:00:00Z");
    const [alert] = buildLiveAlerts("t1", { ...quiet, waitingLeads: 1, oldestWaitingSince: since });
    expect(alert).toMatchObject({
      id: "live:queue_no_broker",
      level: "warning",
      message: "1 lead espera corretor há mais de 15 minutos.",
      href: "/distribuicao?view=plantao",
      live: true,
      createdAt: since,
    });
    expect(buildLiveAlerts("t1", { ...quiet, waitingLeads: 6 })[0]).toMatchObject({ level: "critical", message: "6 leads esperam corretor há mais de 15 minutos." });
  });

  it("falha solta da IA não alerta; falhas seguidas, sim, com o último erro", () => {
    expect(buildLiveAlerts("t1", { ...quiet, aiFailures: AI_FAILURE_ALERT_MIN - 1 })).toEqual([]);
    const [alert] = buildLiveAlerts("t1", { ...quiet, aiFailures: 4, lastAiError: "429 rate limit" });
    expect(alert).toMatchObject({ id: "live:ai_send_failed", level: "critical", href: "/qualificacao?tab=whatsapp_diag" });
    expect(alert?.message).toBe("A IA não conseguiu responder 4 vezes nas últimas 2 horas. Último erro: 429 rate limit");
  });
});
