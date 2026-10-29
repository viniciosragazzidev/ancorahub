import { describe, expect, it } from "vitest";

import { defaultChannelLeadLabel } from "./channel-lead-intake";

describe("default origin of a number's leads", () => {
  it("names the number by its last four digits, with or without formatting", () => {
    expect(defaultChannelLeadLabel("+55 21 96438-3232")).toBe("WhatsApp 3232");
    expect(defaultChannelLeadLabel("5521964383232")).toBe("WhatsApp 3232");
    expect(defaultChannelLeadLabel("(21) 9 6438 3232")).toBe("WhatsApp 3232");
  });

  it("falls back to the channel name when there is no usable number", () => {
    expect(defaultChannelLeadLabel(null)).toBe("WhatsApp");
    expect(defaultChannelLeadLabel(undefined)).toBe("WhatsApp");
    expect(defaultChannelLeadLabel("")).toBe("WhatsApp");
    expect(defaultChannelLeadLabel("123")).toBe("WhatsApp");
  });
});
