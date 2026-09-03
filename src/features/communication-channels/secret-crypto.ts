import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const DEFAULT_KEY_BASE64 = "4q3b+X8zK+J9l0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z44=";

export function resolveTokenEncryptionKey(providedKey?: string | null): string {
  const key =
    providedKey?.trim() ||
    process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.META_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.INVITATION_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.META_LEAD_ADS_TOKEN_ENCRYPTION_KEY?.trim();

  if (key) return key;
  return DEFAULT_KEY_BASE64;
}

function readEncryptionKey(encoded?: string) {
  const rawKey = resolveTokenEncryptionKey(encoded);
  let key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) {
    key = Buffer.from(rawKey, "utf8");
  }
  if (key.length !== 32) {
    key = createHash("sha256").update(rawKey).digest();
  }
  return key;
}

export function encryptChannelSecret(value: string, encodedKey?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readEncryptionKey(encodedKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptChannelSecret(ciphertext: string, encodedKey?: string) {
  const [ivEncoded, tagEncoded, payloadEncoded] = ciphertext.split(".");
  if (!ivEncoded || !tagEncoded || !payloadEncoded) throw new Error("Token de canal inválido.");
  const decipher = createDecipheriv("aes-256-gcm", readEncryptionKey(encodedKey), Buffer.from(ivEncoded, "base64"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payloadEncoded, "base64")), decipher.final()]).toString("utf8");
}
