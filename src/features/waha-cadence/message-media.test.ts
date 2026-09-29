import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/communication-channels/conversation-media", () => ({
  getMediaLimitBytes: () => 16 * 1024 * 1024,
  isConversationMediaEnabled: async () => true,
  mediaKindAcceptsMime: (kind: string, mime: string) => mime.startsWith(`${kind}/`) || kind === "document",
  storeConversationMedia: vi.fn(async (input: { kind: string; mimeType: string; body: Buffer; messageId: string }) => ({
    kind: input.kind, mimeType: input.mimeType, filename: null, sizeBytes: input.body.byteLength,
    storageKey: `whatsapp-media/t/${input.messageId}`, providerId: null, sha256: "x",
  })),
}));
const download = vi.fn();
vi.mock("./relay-client", () => ({ downloadWahaMedia: (url: string) => download(url) }));

import { storeWahaMessageMedia, wahaFilePath, wahaMessageMediaKind } from "./message-media";

describe("wahaMessageMediaKind", () => {
  it("maps file-bearing types and ignores text-like ones", () => {
    expect(wahaMessageMediaKind("audio")).toBe("audio");
    expect(wahaMessageMediaKind("sticker")).toBe("image");
    expect(wahaMessageMediaKind("text")).toBeNull();
    expect(wahaMessageMediaKind("location")).toBeNull();
  });
});

describe("storeWahaMessageMedia", () => {
  it("downloads a voice note through the relay and stores it for the conversation", async () => {
    download.mockResolvedValueOnce({ body: Buffer.from([1, 2, 3]), contentType: "audio/ogg" });
    const stored = await storeWahaMessageMedia({ tenantId: "t", messageRowId: "row-1", type: "audio", media: { providerPath: "/api/files/s/a.oga", mimeType: "audio/ogg; codecs=opus" } });
    expect(download).toHaveBeenCalledWith("/api/files/s/a.oga");
    expect(stored).toMatchObject({ kind: "audio", mimeType: "audio/ogg", sizeBytes: 3, storageKey: "whatsapp-media/t/row-1" });
  });

  it("derives the relay path from a raw WAHA link, ignoring its host", async () => {
    download.mockResolvedValueOnce({ body: Buffer.from([9]), contentType: "image/jpeg" });
    await storeWahaMessageMedia({ tenantId: "t", messageRowId: "row-2", type: "image", media: { url: "http://localhost:3000/api/files/s/x.jpeg" } });
    expect(download).toHaveBeenLastCalledWith("/api/files/s/x.jpeg");
    expect(wahaFilePath("http://evil.example/api/sessions")).toBeNull();
  });

  it("returns null (message still recorded) when there is no file or the download fails", async () => {
    expect(await storeWahaMessageMedia({ tenantId: "t", messageRowId: "r", type: "audio", media: undefined })).toBeNull();
    expect(await storeWahaMessageMedia({ tenantId: "t", messageRowId: "r", type: "text", media: { url: "/api/files/s/a" } })).toBeNull();
    download.mockRejectedValueOnce(new Error("WAHA_MEDIA_FAILED:WAHA_MEDIA_NOT_FOUND"));
    expect(await storeWahaMessageMedia({ tenantId: "t", messageRowId: "r", type: "audio", media: { url: "/api/files/s/a.oga" } })).toBeNull();
  });
});
