import { describe, expect, it } from "vitest";

import { CHANNEL_LEAD_INTAKE_OFF, channelLeadIntakeKey, parseChannelLeadIntake, resolveChannelLeadIntakeRoute, type ChannelLeadIntake } from "./channel-lead-intake";

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

  it("routes new contacts to the queue configured on the number they wrote to", () => {
    const intakeA: ChannelLeadIntake = { enabled: true, queueId: "queue-a", label: "Origem A", aiQualification: false };
    const intakeB: ChannelLeadIntake = { enabled: true, queueId: "queue-b", label: "Origem B", aiQualification: true };
    expect(resolveChannelLeadIntakeRoute({ knownLeadOrClient: false, intake: intakeA }))
      .toMatchObject({ kind: "create_lead", intake: { queueId: "queue-a" } });
    expect(resolveChannelLeadIntakeRoute({ knownLeadOrClient: false, intake: intakeB }))
      .toMatchObject({ kind: "create_lead", intake: { queueId: "queue-b" } });
  });

  it("keeps a known lead ID and queue when the customer writes through another number", () => {
    expect(resolveChannelLeadIntakeRoute({
      knownLeadOrClient: true,
      existingLeadId: "lead-existing",
      existingLeadQueueId: "queue-original",
      intake: { enabled: true, queueId: "queue-b", label: "Origem B", aiQualification: true },
    })).toEqual({ kind: "existing_contact", existingLeadId: "lead-existing", existingQueueId: "queue-original" });
  });

  it("does not create a lead for an already-known client", () => {
    expect(resolveChannelLeadIntakeRoute({
      knownLeadOrClient: true,
      intake: { enabled: true, queueId: "queue-b", label: "Origem B", aiQualification: true },
    })).toEqual({ kind: "existing_contact", existingLeadId: null, existingQueueId: null });
  });
});
