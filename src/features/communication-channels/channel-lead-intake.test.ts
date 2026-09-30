import { describe, expect, it } from "vitest";

import { CHANNEL_LEAD_INTAKE_OFF, channelLeadIntakeKey, parseChannelLeadIntake } from "./channel-lead-intake";

describe("lead intake of a number dedicated to ads", () => {
  it("reads the saved setting and falls back to off", () => {
    expect(parseChannelLeadIntake(JSON.stringify({ enabled: true, queueId: "q1", label: " Anúncios CA1 - Ancora Corretora " })))
      .toEqual({ enabled: true, queueId: "q1", label: "Anúncios CA1 - Ancora Corretora", aiQualification: false });
    expect(parseChannelLeadIntake(null)).toEqual(CHANNEL_LEAD_INTAKE_OFF);
    expect(parseChannelLeadIntake("{quebrado")).toEqual(CHANNEL_LEAD_INTAKE_OFF);
    expect(parseChannelLeadIntake(JSON.stringify({ enabled: "sim", queueId: "", label: "" }))).toEqual(CHANNEL_LEAD_INTAKE_OFF);
    expect(parseChannelLeadIntake(JSON.stringify({ enabled: true, aiQualification: true })).aiQualification).toBe(true);
    expect(channelLeadIntakeKey("abc")).toBe("channel_lead_intake_abc");
  });
});
