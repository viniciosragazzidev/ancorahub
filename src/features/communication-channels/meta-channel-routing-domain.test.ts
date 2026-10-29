import { describe, expect, it } from "vitest";

import {
  formatMetaSourceChannelUnavailableMessage,
  resolveMetaInboundLookup,
  selectMetaOutboundChannel,
  type MetaChannelRoutingCandidate,
} from "./meta-channel-routing-domain";

function channel(overrides: Partial<MetaChannelRoutingCandidate> = {}): MetaChannelRoutingCandidate {
  return {
    id: "official-a",
    phoneNumberId: "phone-a",
    displayPhoneNumber: "+55 21 97350-7000",
    branchId: null,
    status: "active",
    registrationStatus: "registered",
    hasCredentials: true,
    onboardingMode: "cloud_api",
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Coex multi-number decisions", () => {
  it("uses the latest inbound number for a customer response", () => {
    const official = channel();
    const coexistence = channel({
      id: "coex-b", phoneNumberId: "phone-b", displayPhoneNumber: "+55 21 97350-7276",
      onboardingMode: "coexistence", isDefault: false, createdAt: "2026-02-01T00:00:00.000Z",
    });

    expect(selectMetaOutboundChannel({
      channels: [official, coexistence], recipientType: "lead", latestInboundChannelId: "coex-b",
    })).toMatchObject({ kind: "selected", source: "inbound", channel: { id: "coex-b" } });
  });

  it("blocks a customer reply instead of switching when the source number is disconnected", () => {
    const official = channel();
    const disconnected = channel({
      id: "coex-b", phoneNumberId: "phone-b", displayPhoneNumber: "+55 21 97350-7276",
      onboardingMode: "coexistence", isDefault: false, status: "inactive",
    });

    expect(selectMetaOutboundChannel({
      channels: [official, disconnected], recipientType: "lead", latestInboundChannelId: "coex-b",
    })).toEqual({
      kind: "blocked",
      blocked: true,
      reason: "META_SOURCE_CHANNEL_UNAVAILABLE",
      channelLabel: "+55 21 97350-7276",
      message: "O número +55 21 97350-7276 está desconectado; reconecte em Configurações > WhatsApp.",
    });
    expect(formatMetaSourceChannelUnavailableMessage(null)).toBe("O número usado na última mensagem está desconectado; reconecte em Configurações > WhatsApp.");
  });

  it("blocks the source route when the number is active but its token is missing", () => {
    const official = channel();
    const missingToken = channel({
      id: "coex-b", phoneNumberId: "phone-b", displayPhoneNumber: "+55 21 97350-7276",
      onboardingMode: "coexistence", isDefault: false, hasCredentials: false,
    });
    expect(selectMetaOutboundChannel({
      channels: [official, missingToken], recipientType: "client", latestInboundChannelId: "coex-b",
    })).toMatchObject({ kind: "blocked", message: expect.stringContaining("reconecte em Configurações > WhatsApp") });
  });

  it("uses the same deterministic official fallback for customer messages and internal notices", () => {
    const later = channel({ id: "official-later", isDefault: false, createdAt: "2026-02-01T00:00:00.000Z" });
    const first = channel({ id: "official-first", isDefault: false, createdAt: "2026-01-01T00:00:00.000Z" });
    const coexDefaultLegacy = channel({ id: "coex-legacy", onboardingMode: "coexistence", isDefault: true });

    expect(selectMetaOutboundChannel({ channels: [later, coexDefaultLegacy, first], recipientType: "lead" }))
      .toMatchObject({ kind: "selected", source: "official", channel: { id: "official-first" } });
    expect(selectMetaOutboundChannel({ channels: [coexDefaultLegacy, first], recipientType: "user" }))
      .toMatchObject({ kind: "selected", source: "official", channel: { id: "official-first" } });
    expect(selectMetaOutboundChannel({ channels: [later, first], recipientType: "user", pinnedChannelId: "official-later" }))
      .toMatchObject({ kind: "selected", source: "official", channel: { id: "official-first" } });
    expect(selectMetaOutboundChannel({ channels: [first, later], recipientType: "lead", pinnedChannelId: "official-later" }))
      .toMatchObject({ kind: "selected", source: "pinned", channel: { id: "official-later" } });
  });

  it("does not send an internal notice through a pinned coexistence channel", () => {
    const official = channel();
    const coexistence = channel({ id: "coex", onboardingMode: "coexistence", isDefault: false });
    expect(selectMetaOutboundChannel({
      channels: [coexistence, official], recipientType: "user", pinnedChannelId: "coex",
    })).toMatchObject({ kind: "selected", source: "official", channel: { id: "official-a" } });
  });

  it("uses a stable ID tiebreak when official channels have the same creation time", () => {
    const second = channel({ id: "official-b", isDefault: false });
    const first = channel({ id: "official-a", isDefault: false });
    expect(selectMetaOutboundChannel({ channels: [second, first], recipientType: "user" }))
      .toMatchObject({ kind: "selected", channel: { id: "official-a" } });
  });

  it("never makes a Coex number the default internal sender, even when a legacy row requested it", () => {
    const coex = channel({ id: "coex", onboardingMode: "coexistence", isDefault: true });
    expect(selectMetaOutboundChannel({ channels: [coex], recipientType: "user" })).toEqual({ kind: "none" });
  });

  it("prefers a tenant record ID and limits source history to 30 days", () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    const since = new Date("2026-09-29T12:00:00.000Z");
    expect(resolveMetaInboundLookup({ leadId: "lead-1", customerPhone: "+55 21 97350-7276", now }))
      .toEqual({ kind: "lead", id: "lead-1", since, phoneSuffix: "73507276" });
    expect(resolveMetaInboundLookup({ clientId: "client-1", customerPhone: "+55 21 97350-7276", now }))
      .toEqual({ kind: "client", id: "client-1", since, phoneSuffix: "73507276" });
    expect(resolveMetaInboundLookup({ leadId: "lead-1", customerPhone: "12", now }))
      .toEqual({ kind: "lead", id: "lead-1", since, phoneSuffix: null });
  });

  it("uses a normalized phone suffix for unlinked conversations and as the fallback of linked ones, within 30 days", () => {
    const now = new Date("2026-10-29T12:00:00.000Z");
    expect(resolveMetaInboundLookup({ customerPhone: "+55 (21) 97350-7276", now }))
      .toEqual({ kind: "phone", suffix: "73507276", since: new Date("2026-09-29T12:00:00.000Z") });
    expect(resolveMetaInboundLookup({ customerPhone: "123", now })).toBeNull();
  });
});
