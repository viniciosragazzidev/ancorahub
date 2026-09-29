import { describe, it, expect } from "vitest";
import {
  LEAD_STATUS_LABELS,
  MOTIVOS_PERDA,
  MOTIVO_PERDA_LABELS,
  normalizeMotivoPerda,
} from "../lead-status-constants";

describe("LEAD_STATUS_LABELS", () => {
  it("contains labels for all 9 statuses", () => {
    const keys = Object.keys(LEAD_STATUS_LABELS);
    expect(keys).toContain("new");
    expect(keys).toContain("distributed");
    expect(keys).toContain("in_contact");
    expect(keys).toContain("quote_sent");
    expect(keys).toContain("negotiation");
    expect(keys).toContain("documentation_pending");
    expect(keys).toContain("under_analysis");
    expect(keys).toContain("converted");
    expect(keys).toContain("lost");
    expect(keys).toHaveLength(9);
  });

  it("uses Portuguese labels", () => {
    expect(LEAD_STATUS_LABELS.new).toBe("Novo");
    expect(LEAD_STATUS_LABELS.lost).toBe("Perdido");
  });
});

describe("MOTIVOS_PERDA", () => {
  it("contains the canonical loss reasons used by broker and management flows", () => {
    expect(MOTIVOS_PERDA).toHaveLength(10);
    expect(MOTIVOS_PERDA).toContain("preco");
    expect(MOTIVOS_PERDA).toContain("sem_interesse");
    expect(MOTIVOS_PERDA).toContain("sem_contato");
    expect(MOTIVOS_PERDA).toContain("outro");
  });
});

describe("normalizeMotivoPerda", () => {
  it("accepts labels from older clients and returns canonical codes", () => {
    expect(normalizeMotivoPerda("Preço")).toBe("preco");
    expect(normalizeMotivoPerda("Sem interesse")).toBe("sem_interesse");
    expect(normalizeMotivoPerda("Sem contato / Não atende")).toBe("sem_contato");
    expect(normalizeMotivoPerda("preco")).toBe("preco");
    expect(normalizeMotivoPerda("  ")).toBeNull();
  });
});

describe("MOTIVO_PERDA_LABELS", () => {
  it("maps each motivo to a Portuguese label", () => {
    for (const motivo of MOTIVOS_PERDA) {
      expect(MOTIVO_PERDA_LABELS[motivo]).toBeDefined();
      expect(typeof MOTIVO_PERDA_LABELS[motivo]).toBe("string");
      expect(MOTIVO_PERDA_LABELS[motivo].length).toBeGreaterThan(0);
    }
  });
});
