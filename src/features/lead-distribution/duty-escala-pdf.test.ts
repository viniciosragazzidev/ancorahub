import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { encodeDutyEscalaPdf, hueToRgb, type DutyEscalaPdfBroker, type DutyEscalaPdfInput, type DutyEscalaPdfOccurrence, type DutyEscalaPdfType } from "./duty-escala-pdf";

const FIRST_NAMES = ["João", "Conceição", "Márcia", "Sebastião", "Inês", "Rogério", "Ângela", "Lúcia", "André", "Débora"];
const LAST_NAMES = ["Gonçalves", "Araújo", "Simões", "Assunção", "Brandão", "Magalhães", "Conceição de Assis Figueiredo"];
const BRANCHES = ["Unidade Centro", "Unidade Nova Iguaçu", "Unidade Barra da Tijuca"];

function makeBrokers(count: number): DutyEscalaPdfBroker[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`,
    code: index % 9 === 8 ? null : `C${String(100 + index)}`,
    branchName: index % 11 === 10 ? null : BRANCHES[index % BRANCHES.length],
  }));
}

function isoDate(start: Date, offset: number) {
  const date = new Date(start.getTime() + offset * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function buildEscalaFixture(typeCount: number, dateCount = 20, brokerCount = 40): DutyEscalaPdfInput {
  const hues = [210, 145, null, 20, 280, 330, 50, 180];
  const types: DutyEscalaPdfType[] = Array.from({ length: typeCount }, (_, index) => ({
    id: `type-${index}`,
    name: ["PME", "Pessoa Física", "Adesão", "Empresarial Premium", "Odontológico", "Sênior"][index] ?? `Tipo ${index}`,
    hue: hues[index] ?? null,
    modality: index % 2 === 0 ? "presencial" : "online",
  }));
  const brokers = makeBrokers(brokerCount);
  const start = new Date(Date.UTC(2026, 9, 1));
  const occurrences: DutyEscalaPdfOccurrence[] = [];
  let cursor = 0;
  for (let day = 0; day < dateCount; day += 1) {
    const dutyDate = isoDate(start, day);
    types.forEach((type, typeIndex) => {
      if ((day + typeIndex) % 4 === 3) return; // leave some empty cells
      const shifts = typeIndex === 0 && day % 3 === 0 ? 2 : 1;
      for (let shift = 0; shift < shifts; shift += 1) {
        const size = 1 + ((day + typeIndex + shift) % 4);
        occurrences.push({
          id: `occ-${occurrences.length}`,
          typeId: type.id,
          scheduleName: shift === 0 ? `Plantão ${type.name}` : `Plantão ${type.name} tarde`,
          dutyDate,
          startsAt: shift === 0 ? "09:00:00" : "13:30",
          endsAt: shift === 0 ? "13:30:00" : "18:00",
          modality: type.modality,
          minimumBrokers: 3,
          brokers: Array.from({ length: size }, () => brokers[cursor++ % brokers.length]),
        });
      }
    });
    if (day % 5 === 0) {
      occurrences.push({
        id: `occ-${occurrences.length}`,
        typeId: null,
        scheduleName: "Plantão avulso — sábado",
        dutyDate,
        startsAt: "08:00",
        endsAt: "12:00",
        modality: "online",
        minimumBrokers: 2,
        brokers: [brokers[cursor++ % brokers.length]],
      });
    }
  }
  return {
    tenantName: "Âncora Saúde",
    generatedAt: new Date("2026-10-09T12:00:00.000Z"),
    periodLabel: "01/10/2026 a 20/10/2026",
    scopeLabel: "Geral",
    status: "draft",
    showBranch: true,
    types,
    occurrences,
  };
}

async function expectValidPdf(bytes: Uint8Array) {
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  return PDFDocument.load(bytes);
}

describe("duty escala PDF", () => {
  it("derives color families from the hue, with grays for a null hue", () => {
    const blue = hueToRgb(210);
    expect(blue.strong.blue).toBeGreaterThan(blue.strong.red);
    expect(blue.soft.red).toBeGreaterThan(0.9);
    const gray = hueToRgb(null);
    expect(gray.strong.red).toBeCloseTo(gray.strong.blue, 0);
  });

  it("renders the board and the per-broker summary across pages", async () => {
    const bytes = await encodeDutyEscalaPdf(buildEscalaFixture(3));
    const doc = await expectValidPdf(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("splits more than 4 types into bands", async () => {
    const input = buildEscalaFixture(6, 12);
    const bytes = await encodeDutyEscalaPdf({ ...input, status: "published", showBranch: false, scopeLabel: "Unidade Centro" });
    const doc = await expectValidPdf(bytes);
    // band 1 + band 2 (new page) + summary (new page)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });

  it("clips a cell taller than a page instead of overflowing", async () => {
    const input = buildEscalaFixture(1, 1, 80);
    input.occurrences[0].brokers = makeBrokers(80);
    const doc = await expectValidPdf(await encodeDutyEscalaPdf(input));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("still produces a one-page PDF when there are no occurrences", async () => {
    const bytes = await encodeDutyEscalaPdf({ ...buildEscalaFixture(2), occurrences: [] });
    const doc = await expectValidPdf(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
