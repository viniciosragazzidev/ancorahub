import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";
import type { BrokerConversationInsight } from "@/features/broker-workspace/components/light-conversations-view";

import { buildInsightsScript, isWaitingForBroker } from "./insights-script";

const now = new Date("2026-10-09T15:00:00.000Z"); // 12:00 in São Paulo

function conversation(id: string, overrides: Partial<BrokerConversationInsight> & { inboundAt?: string; outbound?: boolean } = {}): BrokerConversationInsight {
  const at = overrides.inboundAt ?? "2026-10-09T14:00:00.000Z";
  const message = { id: `m-${id}`, body: `Oi, sou ${id}, quanto fica o plano?`, direction: overrides.outbound ? "outgoing" : "incoming", sentAt: at };
  return {
    id,
    kind: "lead",
    name: `Cliente ${id}`,
    phone: "21999998888",
    status: "in_contact",
    href: `/leads/${id}`,
    latestMessage: message,
    messages: [message],
    intelligence: null,
    ...overrides,
  };
}

function question(blocks: ChatBlock[]) {
  const block = blocks.find((item) => item.type === "question");
  if (!block || block.type !== "question") throw new Error("no question");
  return block;
}

describe("buildInsightsScript", () => {
  it("starts with whoever waits longest and offers the one-tap reply", () => {
    const script = buildInsightsScript({
      now,
      whatsappConnected: true,
      insights: [
        conversation("b", { inboundAt: "2026-10-09T14:50:00.000Z" }),
        conversation("a", { inboundAt: "2026-10-09T13:00:00.000Z", intelligence: { pendingFrom: "BROKER", nextBestAction: "Mandar a tabela da Amil", summary: "Quer plano para 3 vidas." } }),
        conversation("c", { outbound: true }),
      ],
    });
    expect(script.blocks[0]).toMatchObject({ id: "i-count", text: "2 clientes esperando sua resposta. Comece por Cliente, que espera há 2h." });
    expect(script.blocks.find((block) => block.id === "i-next")).toMatchObject({ text: "Sugestão: Mandar a tabela da Amil" });
    expect(script.blocks.find((block) => block.id === "i-last")).toMatchObject({ type: "system", text: expect.stringContaining("quanto fica o plano") });
    const choices = question(script.blocks).choices;
    expect(choices[0]).toMatchObject({ id: "reply", action: { kind: "href", href: "https://wa.me/5521999998888" } });
    expect(choices[1]?.action).toEqual({ kind: "href", href: "/conversas/broker?leadId=a" });
    expect(script.blocks.find((block) => block.id === "i-others")).toMatchObject({ items: [{ id: "b", trailing: "10 min" }] });
    expect(script.status?.tone).toBe("waiting");
  });

  it("trusts the AI over the last message direction", () => {
    expect(isWaitingForBroker(conversation("x", { intelligence: { pendingFrom: "CUSTOMER" } }))).toBe(false);
    expect(isWaitingForBroker(conversation("y", { outbound: true, intelligence: { pendingFrom: "BROKER" } }))).toBe(true);
    expect(isWaitingForBroker(conversation("z"))).toBe(true);
  });

  it("says when nobody is waiting and lists the recent conversations", () => {
    const script = buildInsightsScript({ now, whatsappConnected: true, insights: [conversation("c", { outbound: true })] });
    expect(script.blocks[0]).toMatchObject({ id: "i-clear" });
    expect(question(script.blocks).choices[0]?.action).toEqual({ kind: "href", href: "/conversas/broker?todas=1" });
    expect(script.status?.tone).toBe("idle");
  });

  it("asks to connect WhatsApp when there is nothing to read", () => {
    const script = buildInsightsScript({ now, whatsappConnected: false, insights: [] });
    expect(question(script.blocks).choices[0]?.action).toEqual({ kind: "href", href: "/settings/whatsapp" });
  });
});
