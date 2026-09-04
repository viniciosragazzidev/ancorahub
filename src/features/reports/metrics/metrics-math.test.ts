import { describe, expect, it } from "vitest";

import {
  buildFunnelRows,
  comparisonDelta,
  formatDeltaPtBR,
  percentage,
  previousWindowStart,
  safeRate,
} from "./metrics-math";

describe("safeRate / percentage", () => {
  it("retorna 0 quando o denominador é 0", () => {
    expect(safeRate(10, 0)).toBe(0);
    expect(percentage(10, 0)).toBe(0);
  });

  it("calcula a taxa da coorte", () => {
    expect(percentage(217, 1284)).toBeCloseTo(16.9, 1);
  });
});

describe("comparisonDelta", () => {
  it("taxa usa pontos percentuais, nunca variação relativa", () => {
    const delta = comparisonDelta(18.4, 16.3, "rate");
    expect(delta.percentagePoints).toBeCloseTo(2.1, 1);
    expect(delta.relativePercent).toBeNull();
    expect(delta.direction).toBe("up");
  });

  it("valor absoluto usa variação relativa", () => {
    const delta = comparisonDelta(217, 190, "value");
    expect(delta.relativePercent).toBeCloseTo(14.2, 1);
    expect(delta.percentagePoints).toBeNull();
  });

  it("período anterior inexistente não inventa delta", () => {
    const delta = comparisonDelta(10, null, "rate");
    expect(delta.percentagePoints).toBeNull();
    expect(delta.direction).toBe("flat");
  });

  it("base zero reporta 100% apenas quando houve crescimento", () => {
    expect(comparisonDelta(5, 0, "value").relativePercent).toBe(100);
    expect(comparisonDelta(0, 0, "value").relativePercent).toBe(0);
  });
});

describe("formatDeltaPtBR", () => {
  it("formata pp com uma casa e sinal", () => {
    expect(formatDeltaPtBR(comparisonDelta(18.4, 16.3, "rate"))).toBe("+2,1 pp");
    expect(formatDeltaPtBR(comparisonDelta(14.7, 18.2, "rate"))).toBe("-3,5 pp");
  });
});

describe("buildFunnelRows", () => {
  it("constrói funil de 8 estágios com reached cumulativo e gargalo", () => {
    const { rows, lost, biggestBottleneck } = buildFunnelRows({
      new: 231,
      distributed: 120,
      in_contact: 411,
      quote_sent: 327,
      negotiation: 173,
      documentation_pending: 60,
      under_analysis: 42,
      converted: 217,
      lost: 240,
    });

    expect(rows).toHaveLength(8);
    expect(rows[0].stage).toBe("new");
    expect(rows[7].stage).toBe("converted");
    expect(rows[0].reached).toBe(231 + 120 + 411 + 327 + 173 + 60 + 42 + 217);
    expect(rows[7].reached).toBe(217);
    expect(rows[7].progressionToNext).toBeNull();
    expect(lost).toBe(240);
    // cotação → negociação perde 327−173 sobre 327+173+60+42+217…
    expect(biggestBottleneck).not.toBeNull();
    expect(biggestBottleneck).toBe(3);
  });

  it("coorte vazia não gera gargalo", () => {
    const { rows, biggestBottleneck } = buildFunnelRows({});
    expect(rows.every((row) => row.reached === 0)).toBe(true);
    expect(biggestBottleneck).toBeNull();
  });
});

describe("previousWindowStart", () => {
  it("devolve a janela imediatamente anterior com a mesma duração", () => {
    const start = new Date(2026, 7, 2); // 02 ago
    const previous = previousWindowStart(start, 30);
    expect(previous.getFullYear()).toBe(2026);
    expect(previous.getMonth()).toBe(6);
    expect(previous.getDate()).toBe(3); // 03 jul
  });
});
