import { describe, expect, it } from "vitest";
import { createR2SignedHeaders } from "@/shared/storage/r2-storage";

describe("createR2SignedHeaders", () => {
  it("assina uma gravação sem expor a chave secreta e codifica o caminho", () => {
    const request = createR2SignedHeaders({
      method: "PUT",
      accountId: "account",
      accessKeyId: "access",
      secretAccessKey: "secret",
      bucket: "files",
      storageKey: "documents/tenant 1/arquivo.pdf",
      body: Buffer.from("conteúdo"),
      contentType: "application/pdf",
      now: new Date("2026-08-03T12:34:56.000Z"),
    });
    expect(request.url).toBe(
      "https://account.r2.cloudflarestorage.com/files/documents/tenant%201/arquivo.pdf",
    );
    expect(request.headers.authorization).toContain(
      "Credential=access/20260803/auto/s3/aws4_request",
    );
    expect(request.headers.authorization).not.toContain("secret");
    expect(request.headers["x-amz-content-sha256"]).toHaveLength(64);
  });
});
