export const REALTIME_SYNC_BROWSER_EVENT = "ancorahub:realtime-sync";

export type RealtimeSyncBrowserDetail = {
  kind: "notification.created" | "notification.read" | "domain.invalidated";
  notificationId?: string;
  domain?: string;
};

export function dispatchRealtimeSyncEvent(detail: RealtimeSyncBrowserDetail) {
  window.dispatchEvent(new CustomEvent<RealtimeSyncBrowserDetail>(REALTIME_SYNC_BROWSER_EVENT, { detail }));
}
