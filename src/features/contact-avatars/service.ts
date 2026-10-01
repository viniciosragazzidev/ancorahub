import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { findConnectedTenantChannelId } from "@/features/waha-cadence/tenant-channel-routing";
import { getWahaProfilePictureUrl } from "@/features/waha-cadence/relay-client";

/** A picture (or "no picture") is asked again only after this. */
const AVATAR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** WhatsApp avatars are small; anything bigger is not an avatar. */
const AVATAR_MAX_BYTES = 1024 * 1024;

/** The same contact under any formatting: country code + DDD + number, last 11 digits. */
export function avatarPhoneKey(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-11) : "";
}

/**
 * The contact's WhatsApp profile picture, read through the company WAHA
 * number and cached for 7 days (also "no picture"). Null when there is none,
 * the company number is not connected, or WhatsApp could not be reached.
 */
export async function getContactAvatar(tenantId: string, phone: string): Promise<{ body: Buffer; contentType: string } | null> {
  const phoneKey = avatarPhoneKey(phone);
  if (!phoneKey) return null;
  const db = getDatabase();
  const [cached] = await db.select().from(schema.contactAvatars)
    .where(and(eq(schema.contactAvatars.tenantId, tenantId), eq(schema.contactAvatars.phoneKey, phoneKey))).limit(1);
  if (cached && Date.now() - cached.fetchedAt.getTime() < AVATAR_TTL_MS) {
    return cached.imageBase64 ? { body: Buffer.from(cached.imageBase64, "base64"), contentType: cached.contentType ?? "image/jpeg" } : null;
  }

  const numberId = await findConnectedTenantChannelId(tenantId);
  if (!numberId) return null;
  const [number] = await db.select({ relaySessionId: schema.wahaNumbers.relaySessionId }).from(schema.wahaNumbers)
    .where(eq(schema.wahaNumbers.id, numberId)).limit(1);
  if (!number?.relaySessionId) return null;

  let picture: { body: Buffer; contentType: string } | null = null;
  try {
    const fullPhone = phone.replace(/\D/g, "");
    const url = await getWahaProfilePictureUrl({ sessionName: number.relaySessionId, phone: fullPhone.length <= 11 ? `55${fullPhone}` : fullPhone });
    if (url) {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const contentType = response.headers.get("content-type") ?? "";
      const body = Buffer.from(await response.arrayBuffer());
      if (response.ok && contentType.startsWith("image/") && body.length > 0 && body.length <= AVATAR_MAX_BYTES) {
        picture = { body, contentType };
      }
    }
  } catch (error) {
    // WhatsApp unreachable: nothing is cached, it is asked again next time.
    console.warn("[contact-avatar] fetch_failed", { tenantId, error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    return null;
  }

  const now = new Date();
  const values = { imageBase64: picture ? picture.body.toString("base64") : null, contentType: picture?.contentType ?? null, fetchedAt: now };
  await db.insert(schema.contactAvatars).values({ tenantId, phoneKey, ...values })
    .onConflictDoUpdate({ target: [schema.contactAvatars.tenantId, schema.contactAvatars.phoneKey], set: values });
  return picture;
}
