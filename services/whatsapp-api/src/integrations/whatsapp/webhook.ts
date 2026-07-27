import { createHmac, timingSafeEqual } from "node:crypto";

export function hasValidMetaSignature(rawBody: string, signature: string | undefined, appSecret: string): boolean {
  const received = signature?.replace(/^sha256=/, "") ?? "";
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const left = Buffer.from(received, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}
