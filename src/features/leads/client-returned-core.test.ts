import { describe, expect, it } from "vitest";

import { assignedDayLabel, shouldNotifyClientReturned } from "./client-returned-core";
import { builtInNoticeVariants } from "@/features/team-notices/variants";
import { teamNoticeForPurpose } from "@/features/team-notices/catalog";

const at = (value: string) => new Date(`${value}-03:00`);

describe("cliente voltou a chamar (29/10)", () => {
  it("notifies when the client writes 24 h or more after the distribution", () => {
    const base = { leadId: "l1", brokerId: "b1", assignedAt: at("2026-10-27T10:00:00"), alreadyNotified: false };
    expect(shouldNotifyClientReturned({ ...base, messageAt: at("2026-10-28T10:00:00") })).toBe(true);
    expect(shouldNotifyClientReturned({ ...base, messageAt: at("2026-10-28T09:59:00") })).toBe(false);
  });

  it("only once per lead and only for a lead with a broker", () => {
    const messageAt = at("2026-10-29T10:00:00");
    expect(shouldNotifyClientReturned({ leadId: "l1", brokerId: "b1", assignedAt: at("2026-10-20T10:00:00"), messageAt, alreadyNotified: true })).toBe(false);
    expect(shouldNotifyClientReturned({ leadId: "l1", brokerId: null, assignedAt: at("2026-10-20T10:00:00"), messageAt, alreadyNotified: false })).toBe(false);
    expect(shouldNotifyClientReturned({ leadId: "l1", brokerId: "b1", assignedAt: null, messageAt, alreadyNotified: false })).toBe(false);
  });

  it("is a team notice with texts for the company number, without a dash", () => {
    expect(teamNoticeForPurpose("leadClientReturned")).toMatchObject({ key: "LEAD_CLIENT_RETURNED", class: "critical", defaultEnabled: true });
    const texts = builtInNoticeVariants({ purpose: "leadClientReturned", broker: "Renan", lead: "Wânia Souza", since: assignedDayLabel(at("2026-10-27T10:00:00")), link: "https://crm.ancorasaude.cloud/leads/l1" }, 10);
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain("*Wânia Souza* mandou mensagem agora. O lead está com você desde 27/10");
    for (const text of texts) {
      expect(text).toContain("https://crm.ancorasaude.cloud/leads/l1");
      expect(text).not.toMatch(/[—–]/);
    }
  });
});
