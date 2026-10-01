import { describe, expect, it } from "vitest";

import { builtInNoticeVariants, INVITE_LINK_PLACEHOLDER, localHour, pickNoticeVariant, timeOfDayGreeting, withInviteLink, type NoticeFields } from "./variants";

const pool = ["builtin:0", "builtin:1", "builtin:2", "builtin:3"].map((key) => ({ key }));

describe("team notice text rotation", () => {
  it("keeps the same version for the same message (a retry does not change the text)", () => {
    expect(pickNoticeVariant(pool, "lead:1:broker:2", null)).toEqual(pickNoticeVariant(pool, "lead:1:broker:2", null));
  });

  it("never repeats the version the person received last", () => {
    for (let index = 0; index < 200; index += 1) {
      const last = pool[index % pool.length]!.key;
      expect(pickNoticeVariant(pool, `seed-${index}`, last)!.key).not.toBe(last);
    }
  });

  it("uses every version across many messages", () => {
    const used = new Set(Array.from({ length: 200 }, (_, index) => pickNoticeVariant(pool, `seed-${index}`, null)!.key));
    expect(used.size).toBe(pool.length);
  });

  it("with a single text, sends it even when it was the last one", () => {
    expect(pickNoticeVariant([{ key: "msg:a" }], "x", "msg:a")).toEqual({ key: "msg:a" });
    expect(pickNoticeVariant([], "x", null)).toBeNull();
  });

  it("gives four different versions that all carry the name, the lead and the link", () => {
    const fields: NoticeFields = { purpose: "brokerLeadNotification", broker: "Ana", lead: "Maria Souza", product: "Plano de saúde", link: "https://crm.example/leads/1" };
    const versions = builtInNoticeVariants(fields, 9);
    expect(new Set(versions).size).toBe(4);
    for (const version of versions) {
      expect(version).toContain("Ana");
      expect(version).toContain("Maria Souza");
      expect(version).toContain("https://crm.example/leads/1");
      expect(version).not.toMatch(/[​-‍﻿]/);
    }
  });

  it("first-access invite: the secret link is only put in at send time, also in a library message without a place for it", () => {
    const versions = builtInNoticeVariants({ purpose: "brokerInvitation", name: "Ana", company: "Âncora", link: INVITE_LINK_PLACEHOLDER }, 9);
    expect(new Set(versions).size).toBe(4);
    for (const version of versions) {
      expect(version).toContain(INVITE_LINK_PLACEHOLDER);
      const sent = withInviteLink(version, "https://crm.example/convite/abc");
      expect(sent).toContain("https://crm.example/convite/abc");
      expect(sent).not.toContain(INVITE_LINK_PLACEHOLDER);
    }
    expect(withInviteLink("Olá Ana, bem-vinda!", "https://crm.example/convite/abc")).toBe("Olá Ana, bem-vinda!\n\nhttps://crm.example/convite/abc");
  });

  it("greets by the time of day in São Paulo", () => {
    expect(timeOfDayGreeting(9)).toBe("Bom dia");
    expect(timeOfDayGreeting(14)).toBe("Boa tarde");
    expect(timeOfDayGreeting(21)).toBe("Boa noite");
    expect(localHour(new Date("2026-09-29T12:00:00Z"))).toBe(9);
  });
});
