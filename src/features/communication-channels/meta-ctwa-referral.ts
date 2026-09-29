import type { MetaWebhookReferral } from "./types";

/**
 * Click-to-WhatsApp ads (CTWA): the customer taps the ad and writes to the
 * company number. Meta sends the ad in the first message's `referral`. Such a
 * first message is a lead from that ad, governed by the same capture policy
 * and queue routes as the form leads of the same campaign.
 */
export const META_CTWA_ENTRY = "whatsapp";

/** Only an ad referral makes an unknown number a lead; a post or other source stays conversation history. */
export function readCtwaAdReferral(referral: MetaWebhookReferral | undefined) {
  const adId = referral?.source_type === "ad" ? referral.source_id?.trim() : "";
  if (!adId || !/^\d{5,32}$/.test(adId)) return null;
  return {
    adId,
    headline: referral?.headline?.trim().slice(0, 160) || null,
    sourceUrl: referral?.source_url?.trim().slice(0, 300) || null,
    ctwaClid: referral?.ctwa_clid?.trim().slice(0, 200) || null,
  };
}

/** Profile name when usable, otherwise a neutral name with the phone's last digits. */
export function ctwaLeadName(profileName: string | undefined, phone: string) {
  const name = profileName?.replace(/\s+/g, " ").trim().slice(0, 160) ?? "";
  if (name.length >= 2 && /\p{L}/u.test(name)) return name;
  return `Lead WhatsApp anúncio (${phone.replace(/\D/g, "").slice(-4)})`;
}
