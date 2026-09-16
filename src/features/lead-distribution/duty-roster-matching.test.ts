import { describe, expect, it } from "vitest";

import { selectMatchingDutyScheduleIds } from "./duty-roster-matching";

const allOrigins = { id: "all", webhookCredentialId: null };
const metaAds = { id: "meta", webhookCredentialId: "credential-meta" };
const googleAds = { id: "google", webhookCredentialId: "credential-google" };

describe("selectMatchingDutyScheduleIds", () => {
  it("aplica o plantão de todas as origens mesmo quando o lead tem credencial", () => {
    expect(selectMatchingDutyScheduleIds([allOrigins, metaAds], "credential-google")).toEqual(["all"]);
  });

  it("combina o plantão geral com o plantão específico da origem", () => {
    expect(selectMatchingDutyScheduleIds([allOrigins, metaAds, googleAds], "credential-meta")).toEqual([
      "all",
      "meta",
    ]);
  });

  it("não usa plantão específico quando a origem do lead é desconhecida", () => {
    expect(selectMatchingDutyScheduleIds([allOrigins, metaAds], null)).toEqual(["all"]);
  });
});
