"use client";

import { getPushPublicKeyAction, subscribeUserAction } from "./push-actions";
import { getPushAvailability } from "./push-availability";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const rawData = window.atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(rawData, (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Asks the browser and saves the subscription (same steps as Notificações). */
export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: "blocked" | "unavailable" | "error" }> {
  const vapidKey = (await getPushPublicKeyAction().catch(() => null)) || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const availability = getPushAvailability({
    hasNotificationApi: "Notification" in window,
    hasPushManager: "PushManager" in window,
    hasServiceWorker: "serviceWorker" in navigator,
    permission: "Notification" in window ? Notification.permission : "unsupported",
    hasVapidPublicKey: Boolean(vapidKey),
  });
  if (availability === "blocked") return { ok: false, reason: "blocked" };
  if (availability !== "ready") return { ok: false, reason: "unavailable" };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "blocked" };
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToArrayBuffer(vapidKey) });
    const result = await subscribeUserAction(JSON.parse(JSON.stringify(subscription)));
    return result.success ? { ok: true } : { ok: false, reason: "error" };
  } catch (error) {
    console.error("[push] enable failed", error);
    return { ok: false, reason: "error" };
  }
}
