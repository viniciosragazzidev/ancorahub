import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";
import type { BrokerConversationInsight } from "@/features/broker-workspace/components/light-conversations-view";

import { buildInsightThreads, buildInsightsScript, buildLeadInsightScript, isWaitingForBroker } from "./insights-script";

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
    expect(script.blocks.find((block) => block.id === "i-next")).toMatchObject({ text: "Próximo passo: Mandar a tabela da Amil" });
    // Insights never copies the transcript: no client message quoted.
    expect(JSON.stringify(script.blocks)).not.toContain("quanto fica o plano");
    const choices = question(script.blocks).choices;
    expect(choices[0]).toMatchObject({ id: "reply", action: { kind: "href", href: "https://wa.me/5521999998888" } });
    expect(choices[1]?.action).toEqual({ kind: "href", href: "/conversas/broker?insight=a" });
    expect(choices[2]?.action).toEqual({ kind: "href", href: "/leads/a" });
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

  it("lists every conversation as chat rows, who waits for you first, each opening its analysis", () => {
    const threads = buildInsightThreads([
      conversation("old", { outbound: true, inboundAt: "2026-10-09T10:00:00.000Z" }),
      conversation("wait", { inboundAt: "2026-10-09T09:00:00.000Z", intelligence: { pendingFrom: "BROKER", nextBestAction: "Mandar a cotação" } }),
    ]);
    expect(threads.map((thread) => thread.id)).toEqual(["insight:wait", "insight:old"]);
    expect(threads[0]).toMatchObject({ waitingYou: true, preview: "Próximo passo: Mandar a cotação", href: "/conversas/broker?insight=wait", initials: "CW" });
    expect(threads[1]?.preview.startsWith("Você: ")).toBe(true);
  });
});

describe("buildLeadInsightScript", () => {
  it("shows the analysis, signals, objections, next step and tips, never the messages", () => {
    const script = buildLeadInsightScript({
      now,
      item: conversation("a", {
        intelligence: {
          summary: "Quer plano PME para 3 vidas, comparando Amil e SulAmérica.",
          nextBestAction: "SEND_REVISED_QUOTE",
          pendingFrom: "BROKER",
          sentiment: "NEGATIVE",
          customerIntent: "HIGH",
          conversationStage: "QUOTE_PRESENTED",
          engagement: "LOW",
          risk: "Pode fechar com outro corretor",
          opportunity: "Família inteira pode entrar",
          objections: ["Preço acima do esperado"],
          buyingSignals: ["Perguntou a carência"],
          lastAnalyzedAt: "2026-10-09T14:00:00.000Z",
        },
      }),
    });
    const ids = script.blocks.map((block) => block.id);
    expect(ids).toEqual(expect.arrayContaining(["n-summary", "n-reading", "n-signals", "n-objections", "n-risk", "n-opportunity", "n-step", "n-tip-0", "n-choice"]));
    expect(script.blocks.find((block) => block.id === "n-step")).toMatchObject({ text: "Próximo passo: Mandar uma cotação revisada" });
    expect(script.blocks.find((block) => block.id === "n-reading")).toMatchObject({ rows: expect.arrayContaining([{ label: "Intenção de compra", value: "Alta" }, { label: "Quem deve responder", value: "Você" }]) });
    expect(script.blocks.filter((block) => block.id.startsWith("n-tip-")).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(script.blocks)).not.toContain("quanto fica o plano");
    expect(script.blocks.find((block) => block.id === "n-date")).toMatchObject({ label: "Análise de hoje, 11:00" });
  });

  it("explains when there is no analysis yet", () => {
    const script = buildLeadInsightScript({ now, item: conversation("b") });
    expect(script.blocks[0]).toMatchObject({ id: "n-empty" });
  });
});
