// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title, rightSlot }: { title: string; rightSlot?: React.ReactNode }) => <header><h1>{title}</h1>{rightSlot}</header>,
}));
vi.mock("@/components/period-select", () => ({ PeriodSelect: () => <select aria-label="Período" /> }));
vi.mock("@/features/dashboard/components/dashboard-section-tabs", () => ({
  DashboardSectionTabs: () => <nav aria-label="Seções do dashboard">Visão da operação · Qualidade dos leads</nav>,
}));

import type { LeadQualityDimension, LeadQualityReport, LeadQualitySegment } from "../metrics/lead-quality-service";
import { LeadQualityCenter } from "./lead-quality-center";

const dimensionKeys: LeadQualityDimension[] = ["source", "campaign", "adset", "ad", "form", "queue", "broker", "lead_type", "plan_type", "city", "age_band", "hour"];
const segments = Object.fromEntries(dimensionKeys.map((dimension) => [dimension, []])) as unknown as Record<LeadQualityDimension, LeadQualitySegment[]>;
segments.ad = [{
  dimension: "ad", key: "ad-1", label: "Anúncio PME", total: 8, hot: 2, warm: 3, cold: 1,
  unclassified: 2, converted: 1, hotWarmConverted: 1, assigned: 6, metaAttributed: 8,
  averageFirstContactSeconds: 420, hotWarmShare: 71.4, conversionRate: 12.5,
}];
segments.queue = [{
  dimension: "queue", key: "queue-1", label: "Fila Centro", total: 8, hot: 2, warm: 3, cold: 1,
  unclassified: 2, converted: 1, hotWarmConverted: 1, assigned: 6, metaAttributed: 8,
  averageFirstContactSeconds: 420, hotWarmShare: 71.4, conversionRate: 12.5,
}];

const report: LeadQualityReport = {
  enabled: true,
  period: 30,
  generatedAt: "2026-10-01T12:00:00.000Z",
  summary: {
    total: 8, hot: 2, warm: 3, cold: 1, unclassified: 2, classified: 6,
    converted: 1, hotWarmConverted: 1, assigned: 6, metaAttributed: 8,
    averageFirstContactSeconds: 420, classificationCoverage: 75, hotWarmShare: 83.3,
    hotWarmConversionRate: 20, conversionRate: 12.5, assignedRate: 75,
    metaAdAttributionCoverage: 100,
    temperatureDistribution: { hot: 25, warm: 37.5, cold: 12.5, unclassified: 25 },
  },
  segments,
  focus: null,
  focusedLeads: [],
  focusedLeadCount: 0,
};

afterEach(() => cleanup());

describe("LeadQualityCenter", () => {
  it("organizes acquisition and current queue data, with actionable drill-down links", () => {
    render(<LeadQualityCenter report={report} />);
    expect(screen.getByRole("heading", { name: "Qualidade dos leads" })).toBeTruthy();
    expect(screen.getByText("Temperatura registrada")).toBeTruthy();
    expect(screen.getByText("Campanhas e anúncios")).toBeTruthy();
    expect(screen.getByText("Para onde foram e quem atende")).toBeTruthy();
    expect(screen.getByText("Quem está chegando")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Anúncio PME" }).getAttribute("href")).toContain("dimension=ad");
    expect(screen.getByRole("link", { name: "Fila Centro" }).getAttribute("href")).toContain("dimension=queue");
    expect(screen.getByText(/sem estimativa de investimento, CPL ou CPA/i)).toBeTruthy();
  });

  it("respeita o desligamento global e deixa uma saída para o dashboard", () => {
    render(<LeadQualityCenter report={{ ...report, enabled: false }} showQualityTab={false} />);
    expect(screen.getByText("Central temporariamente indisponível")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar ao dashboard" }).getAttribute("href")).toBe("/dashboard");
  });
});
