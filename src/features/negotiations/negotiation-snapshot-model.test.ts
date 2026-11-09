import { describe, expect, it } from "vitest";

import { createNegotiationsFixture } from "./fixtures";
import {
  buildClosingHistoryView,
  buildNegotiationSnapshot,
  diffClosingLeads,
  negotiationSnapshotDay,
  parseClosingLeads,
  shapeClosingLeads,
  type ClosingSnapshotLead,
} from "./negotiation-snapshot-model";

const lead = (leadId: string, name: string, branchId: string | null = "b1"): ClosingSnapshotLead => ({
  leadId, name, brokerId: `broker-${leadId}`, brokerName: `Corretor ${leadId}`, branchId, status: "under_analysis", daysAtStage: 3,
});

describe("foto diária do fechamento", () => {
  it("o dia é o de São Paulo: a rodada das 23:55 (02:55 UTC) ainda é o dia que termina", () => {
    expect(negotiationSnapshotDay(new Date("2026-11-10T02:55:00.000Z"))).toBe("2026-11-09");
    expect(negotiationSnapshotDay(new Date("2026-11-10T03:05:00.000Z"))).toBe("2026-11-10");
  });

  it("guarda os números da tela e só quem está em fechamento, com corretor e dias na etapa", () => {
    const data = createNegotiationsFixture("director");
    const snapshot = buildNegotiationSnapshot(data, new Date("2026-11-10T02:55:00.000Z"));
    expect(snapshot.day).toBe("2026-11-09");
    expect(snapshot.counts).toEqual(data.counts);
    expect(snapshot.closingLeads).toHaveLength(data.counts.closing);
    const sample = snapshot.closingLeads[0]!;
    expect(Object.keys(sample).sort()).toEqual(["branchId", "brokerId", "brokerName", "daysAtStage", "leadId", "name", "status"]);
    expect(snapshot.closingLeads.map((item) => item.name)).toEqual([...snapshot.closingLeads.map((item) => item.name)].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("lê o jsonb de volta e descarta entradas quebradas", () => {
    expect(parseClosingLeads(null)).toEqual([]);
    expect(parseClosingLeads([{ leadId: "a", name: "Ana", brokerId: "x", brokerName: "Bia", branchId: null, status: "under_analysis", daysAtStage: 2 }, { name: "sem id" }, 3])).toEqual([
      { leadId: "a", name: "Ana", brokerId: "x", brokerName: "Bia", branchId: null, status: "under_analysis", daysAtStage: 2 },
    ]);
  });

  it("compara dois dias: quem entrou e quem saiu", () => {
    const diff = diffClosingLeads([lead("a", "Ana"), lead("b", "Bruno")], [lead("b", "Bruno"), lead("c", "Carla")]);
    expect(diff.entered.map((item) => item.leadId)).toEqual(["c"]);
    expect(diff.left.map((item) => item.leadId)).toEqual(["a"]);
    expect(diffClosingLeads([lead("a", "Ana")], [lead("a", "Ana")])).toEqual({ entered: [], left: [] });
  });

  it("faixa do diretor: 7 últimas fotos em ordem e comparação de agora com a última foto de antes de hoje", () => {
    const snapshots = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]
      .reverse()
      .map((day, index) => ({ day, closingLeads: index === 0 ? [lead("a", "Ana"), lead("b", "Bruno", "b2")] : [lead("a", "Ana")] }));
    const view = buildClosingHistoryView({ snapshots, liveClosing: [lead("b", "Bruno", "b2"), lead("c", "Carla")], now: new Date("2026-11-09T15:00:00.000Z") });
    expect(view.days.map((day) => day.day)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(view.days.at(-1)?.count).toBe(2);
    expect(view.baselineDay).toBe("2026-11-08");
    expect(view.entered.map((item) => item.leadId)).toEqual(["c"]);
    expect(view.left.map((item) => item.leadId)).toEqual(["a"]);

    const branch = buildClosingHistoryView({ snapshots, liveClosing: [lead("b", "Bruno", "b2"), lead("c", "Carla")], now: new Date("2026-11-09T15:00:00.000Z"), branchId: "b2" });
    expect(branch.days.at(-1)?.count).toBe(1);
    expect(branch.entered).toEqual([]);
    expect(branch.left).toEqual([]);
  });

  it("com a foto de hoje já tirada, compara com a de ontem; sem foto, não há faixa", () => {
    const view = buildClosingHistoryView({
      snapshots: [{ day: "2026-11-09", closingLeads: [lead("a", "Ana")] }, { day: "2026-11-08", closingLeads: [] }],
      liveClosing: [lead("a", "Ana")],
      now: new Date("2026-11-10T02:56:00.000Z"),
    });
    expect(view.baselineDay).toBe("2026-11-08");
    expect(view.entered.map((item) => item.leadId)).toEqual(["a"]);
    expect(buildClosingHistoryView({ snapshots: [], liveClosing: [lead("a", "Ana")], now: new Date() })).toEqual({ days: [], baselineDay: null, entered: [], left: [] });
  });

  it("só leads no nível fechamento entram na foto", () => {
    const data = createNegotiationsFixture("director");
    expect(shapeClosingLeads(data.leads).every((item) => data.leads.find((source) => source.id === item.leadId)?.level === "closing")).toBe(true);
  });
});
