// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), runServerAction: vi.fn(), invokeAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("./chat-screen", () => ({ ChatScreen: (props: { runAction: (action: unknown) => Promise<unknown> }) => { mocks.invokeAction.mockImplementation(props.runAction); return null; } }));
vi.mock("@/features/broker-workspace/chat/chat-actions", () => ({ runChatServerAction: mocks.runServerAction }));
vi.mock("@/features/broker-workspace/chat/assistant-scripts", () => ({ ASSISTANTS: {}, JACK_ASK_PREFIX: "jack:" }));
vi.mock("@/features/assist/catalog", () => ({ bestAssistMatch: vi.fn(() => null) }));
vi.mock("@/features/assist/components/assist-layer", () => ({ useAssist: () => null }));
vi.mock("@/features/ai-gateway/ask-assistant", () => ({ askAssistantAction: vi.fn() }));

import { AssistantChat } from "./assistant-chat";

afterEach(() => cleanup());

describe("AssistantChat", () => {
  it("accepts a lead and opens it immediately without an extra confirmation tap", async () => {
    mocks.runServerAction.mockResolvedValue({ ok: true, message: "Aceito.", href: "/leads/lead-1" });
    render(<AssistantChat identity={{ name: "Leads", shape: "mochi", hue: 212 }} script={{ blocks: [] }} />);

    const result = await mocks.invokeAction({ name: "lead.accept", payload: { leadId: "lead-1" } });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/lead-1"));
    expect(result).toMatchObject({ ok: true, followUp: [] });
  });
});
