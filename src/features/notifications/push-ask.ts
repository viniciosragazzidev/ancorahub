"use client";

/** True when it makes sense to ask: push works here, the browser never answered and this device has no subscription. */
export async function canAskForPush() {
  if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) return false;
  if (Notification.permission !== "default") return false;
  try {
    // serviceWorker.ready never settles without a worker: give up quickly so the tour is never held.
    const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500))]);
    if (!registration) return false;
    return !(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
