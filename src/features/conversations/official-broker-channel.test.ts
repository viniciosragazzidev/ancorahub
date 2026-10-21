import { describe, expect, it } from "vitest";

import { companyPhoneList, isCompanyPhone, isOfficialBrokerChannelInbound, officialBrokerPhoneSuffix } from "./official-broker-channel";
import { isStatusBroadcastMessage } from "./status-broadcast";

// Fictional numbers with the 21/10 shapes: diretoria …4925, materiais …7782.
const DIRETORIA = "5521998874925";
const MATERIAIS = "5521987657782";
const COMPANY = [DIRETORIA, MATERIAIS];

describe("isOfficialBrokerChannelInbound", () => {
  it("hides chatter between the company numbers (21/10: …4925 wrote to …7782)", () => {
    // "safado, nem deixou eu fazer a troca" came from the diretoria number, which
    // is also the phone of the member profile "Plantão Corretor".
    expect(isOfficialBrokerChannelInbound({ phone: DIRETORIA, messageId: "false_5521998874925@c.us_ABC" }, COMPANY)).toBe(false);
    // Same number stored without 55 or without the 9th digit.
    expect(isOfficialBrokerChannelInbound({ phone: "21998874925" }, COMPANY)).toBe(false);
    expect(isOfficialBrokerChannelInbound({ phone: "552198874925" }, COMPANY)).toBe(false);
  });

  it("shows a broker's WAHA message to the diretoria number and a Meta message", () => {
    expect(isOfficialBrokerChannelInbound({ phone: "5521998765651", messageId: "false_5521998765651@c.us_3EB0" }, COMPANY)).toBe(true);
    expect(isOfficialBrokerChannelInbound({ phone: "5521998765651", messageId: "wamid.HBgN" }, COMPANY)).toBe(true);
  });

  it("hides a broker's WhatsApp Status/story (21/10: Vanessa's 'Cantinho que amo!' video)", () => {
    expect(isOfficialBrokerChannelInbound({ phone: "5521998765651", messageId: "false_status@broadcast_A564FF922F6FD_206066@lid" }, COMPANY)).toBe(false);
  });
});

describe("company numbers", () => {
  it("keeps only real phones and matches across the 9th digit", () => {
    expect(companyPhoneList(["+55 (21) 99887-4925", "Pendente (a1b2c3)", null])).toEqual([DIRETORIA]);
    expect(isCompanyPhone("2198874925", COMPANY)).toBe(true);
    expect(isCompanyPhone("5521998765651", COMPANY)).toBe(false);
  });
});

describe("isStatusBroadcastMessage", () => {
  it("recognises the stored status ids, outgoing and incoming", () => {
    expect(isStatusBroadcastMessage({ messageId: "true_status@broadcast_AC251E_5521911116063@c.us" })).toBe(true);
    expect(isStatusBroadcastMessage({ messageId: "false_5521998765651@c.us_3EB0" })).toBe(false);
    expect(isStatusBroadcastMessage({ messageId: null, phone: "status@broadcast" })).toBe(true);
  });
});

describe("officialBrokerPhoneSuffix", () => {
  it("uses the 8-digit subscriber suffix, stable with or without country code and ninth digit", () => {
    expect(officialBrokerPhoneSuffix("5521912344925")).toBe("12344925");
    expect(officialBrokerPhoneSuffix("21912344925")).toBe("12344925");
    expect(officialBrokerPhoneSuffix("2112344925")).toBe("12344925");
  });

  it("returns null for a number too short to match safely", () => {
    expect(officialBrokerPhoneSuffix("4925")).toBeNull();
  });
});
