import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function readEncryptionKey(encoded: string) {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("META_WHATSAPP_TOKEN_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.");
  return key;
}

export function encryptChannelSecret(value: string, encodedKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readEncryptionKey(encodedKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptChannelSecret(ciphertext: string, encodedKey: string) {
  const [ivEncoded, tagEncoded, payloadEncoded] = ciphertext.split(".");
  if (!ivEncoded || !tagEncoded || !payloadEncoded) throw new Error("Token de canal inválido.");
  const decipher = createDecipheriv("aes-256-gcm", readEncryptionKey(encodedKey), Buffer.from(ivEncoded, "base64"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payloadEncoded, "base64")), decipher.final()]).toString("utf8");
}
