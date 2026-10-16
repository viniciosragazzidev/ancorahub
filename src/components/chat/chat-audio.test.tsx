// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { ChatAudioPlayer, formatAudioTime } from "./chat-audio";
import { ChatBlockView } from "./chat-blocks";

afterEach(() => cleanup());

describe("formatAudioTime", () => {
  it("formats seconds the way a voice note shows them", () => {
    expect(formatAudioTime(0)).toBe("0:00");
    expect(formatAudioTime(7.9)).toBe("0:07");
    expect(formatAudioTime(92)).toBe("1:32");
    expect(formatAudioTime(Number.NaN)).toBe("0:00");
  });
});

describe("ChatAudioPlayer", () => {
  it("offers play and a seekable progress bar for the media route", () => {
    const { container } = render(<ChatAudioPlayer url="/api/conversations/media/m1" />);

    expect(screen.getByRole("button", { name: "Ouvir áudio" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Posição do áudio" })).toBeTruthy();
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("/api/conversations/media/m1");
    expect(container.querySelector("audio")?.getAttribute("preload")).toBe("none");
  });

  it("says the audio is unavailable when the media route fails", () => {
    const { container } = render(<ChatAudioPlayer url="/api/conversations/media/m1" />);

    fireEvent.error(container.querySelector("audio")!);

    expect(screen.getByText("Áudio indisponível")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ouvir áudio" })).toBeNull();
  });
});

describe("WhatsApp bubble with audio", () => {
  it("renders the player and no empty text line when the voice note has no caption", () => {
    const { container } = render(
      <ChatBlockView block={{ type: "whatsapp", id: "wa-1", text: "", from: "client", audio: { url: "/api/conversations/media/m1" } }} />,
    );

    expect(screen.getByRole("button", { name: "Ouvir áudio" })).toBeTruthy();
    expect(container.querySelector("p[class*='bubbleText']")).toBeNull();
  });

  it("keeps the caption under the player when there is one", () => {
    render(<ChatBlockView block={{ type: "whatsapp", id: "wa-2", text: "Ouve isso", from: "broker", audio: { url: "/api/conversations/media/m2" } }} />);

    expect(screen.getByRole("button", { name: "Ouvir áudio" })).toBeTruthy();
    expect(screen.getByText("Ouve isso")).toBeTruthy();
  });
});
