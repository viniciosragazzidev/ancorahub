import { describe, expect, it } from "vitest";

import { getLeadProductLabel, readMetaLeadDisplayDetails } from "./meta-lead-display";

describe("Meta lead display details", () => {
  it("uses the Meta form's product answer instead of the database default", () => {
    expect(getLeadProductLabel({
      tipo: "PF",
      sourceChannel: "meta_lead_ads",
      sourceMetadata: { tipoPlano: "Empresarial PME", tipoPlanoStatus: "provided" },
    })).toBe("Empresarial PME");
  });

  it("shows missing Meta product answers as unknown rather than claiming PF", () => {
    expect(getLeadProductLabel({
      tipo: "PF",
      sourceChannel: "meta_lead_ads",
      sourceMetadata: { tipoPlanoStatus: "not_provided", tipoCnpj: "MEI" },
    })).toBe("Não informado");
  });

  it("keeps legacy values and non-Meta channels unchanged", () => {
    expect(getLeadProductLabel({ tipo: "PME", sourceChannel: "meta_lead_ads", sourceMetadata: {} })).toBe("PME");
    expect(getLeadProductLabel({ tipo: "PF", sourceChannel: "landing_page", sourceMetadata: { tipoPlano: "PME" } })).toBe("PF");
  });

  it("reads only the supported Meta details and bounds displayed text", () => {
    expect(readMetaLeadDisplayDetails("meta_lead_ads", {
      tipoPlano: "  Empresarial ", tipoPlanoStatus: "provided", tipoCnpj: " MEI ", operadora: " SulAmérica ",
      medicalHistory: "must not be surfaced",
    })).toEqual({ tipoPlano: "Empresarial", tipoPlanoStatus: "provided", tipoCnpj: "MEI", operadora: "SulAmérica" });
    expect(readMetaLeadDisplayDetails("webhook", { operadora: "SulAmérica" })).toEqual({
      tipoPlano: null, tipoPlanoStatus: null, tipoCnpj: null, operadora: null,
    });
  });
});
