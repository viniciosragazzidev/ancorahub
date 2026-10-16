// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/chat/chat-screen", () => ({
  ChatScreen: ({ script, composerDisabled }: { script: { blocks: Array<{ type: string; text?: string }>; status?: { label: string } }; composerDisabled: boolean }) => (
    <div data-testid="chat" data-composer-disabled={String(composerDisabled)}>
      <span>{script.status?.label}</span>
      {script.blocks.map((block) => <p key={`${block.type}-${block.text}`}>{block.type}: {block.text}</p>)}
    </div>
  ),
}));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <p>{title}</p> }));

import { TeamLeadConversation, readOnlyWhatsAppBlocks } from "./team-lead-conversation";

const messages = [
  { id: "1", body: "Tenho interesse", at: "2026-10-15T12:00:00.000Z", fromClient: true, byAi: false, mediaKind: null },
  { id: "2", body: "Qual plano procura?", at: "2026-10-15T12:01:00.000Z", fromClient: false, byAi: true, mediaKind: null },
  { id: "3", body: "", at: "2026-10-15T12:02:00.000Z", fromClient: false, byAi: false, mediaKind: "image" },
];

afterEach(() => cleanup());

describe("TeamLeadConversation", () => {
  it("admits only transcript messages and maps the sender", () => {
    const blocks = readOnlyWhatsAppBlocks(messages);
    expect(blocks.map((block) => block.type)).toEqual(["whatsapp", "whatsapp", "whatsapp"]);
    expect(blocks.map((block) => block.type === "whatsapp" && block.from)).toEqual(["client", "qualification", "broker"]);
    expect(blocks[2]).toMatchObject({ type: "whatsapp", text: "Imagem" });
  });

  it("renders the team conversation read only", () => {
    render(<TeamLeadConversation brokerWhatsAppConnected conversation={{ leadId: "lead-1", leadName: "Marina Alves", brokerName: "Paulo Dias", messages }} />);
    expect(screen.getByRole("heading", { name: "Conversa do WhatsApp" })).toBeTruthy();
    expect(screen.getByTestId("chat").getAttribute("data-composer-disabled")).toBe("true");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Somente leitura")).toBeTruthy();
    expect(screen.queryByText("question:")).toBeNull();
  });

  it("shows an Arc empty state when no WhatsApp messages exist", () => {
    render(<TeamLeadConversation brokerWhatsAppConnected conversation={{ leadId: "lead-1", leadName: "Marina Alves", brokerName: null, messages: [] }} />);
    expect(screen.getByText("Ainda não há mensagens")).toBeTruthy();
    expect(screen.queryByTestId("chat")).toBeNull();
  });

  it("hides the live conversation when the broker WhatsApp status from G3 is disconnected", () => {
    render(<TeamLeadConversation brokerWhatsAppConnected={false} conversation={{ leadId: "lead-1", leadName: "Marina Alves", brokerName: "Paulo Dias", messages }} />);

    expect(screen.getByText("Visualização ao vivo desativada, corretor não conectou o WhatsApp")).toBeTruthy();
    expect(screen.queryByTestId("chat")).toBeNull();
    expect(screen.queryByText("Tenho interesse")).toBeNull();
  });
});
