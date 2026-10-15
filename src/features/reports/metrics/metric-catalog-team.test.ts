import { describe, expect, it } from "vitest";

import { getMetricDefinition } from "./metric-catalog";

describe("canonical team metrics", () => {
  it("keeps entry-cohort conversion canonical and available to team dimensions", () => {
    expect(getMetricDefinition("commercial.conversion_rate")).toMatchObject({
      allowedDimensions: expect.arrayContaining(["unit", "team", "broker"]),
      description: expect.stringContaining("Coorte de entrada"),
    });
    expect(getMetricDefinition("commercial.leads_converted")?.explanation).toContain("commercial.conversion_rate");
  });

  it("registers operational indicators as team metrics for unit, team, and broker scopes", () => {
    const ids = [
      "team.offers_received", "team.offers_accepted", "team.acceptance_rate", "team.median_acceptance_time",
      "team.redistributions", "team.first_contact_sla_rate", "team.active_leads", "team.overdue_returns",
      "team.critical_overdue_returns", "team.leads_without_next_action", "team.quotes", "team.sales", "team.losses",
      "team.last_activity_at",
    ];
    for (const id of ids) {
      expect(getMetricDefinition(id), id).toMatchObject({
        allowedDimensions: expect.arrayContaining(["unit", "team", "broker"]),
      });
    }
  });
});
