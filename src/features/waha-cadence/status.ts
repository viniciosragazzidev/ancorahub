/**
 * Canonical WAHA status mapping shared by every transport and UI action.
 * Provider versions are not consistent about casing or the name used while
 * a device is completing the QR handshake, so callers must not compare raw
 * provider strings directly.
 */
const READY_STATUSES = new Set(["WORKING", "CONNECTED", "READY", "AUTHENTICATED", "OPEN", "ONLINE"]);
const ERROR_STATUSES = new Set(["FAILED", "ERROR", "INVALID", "UNAVAILABLE"]);
const INITIALIZING_STATUSES = new Set([
  "SCAN_QR_CODE",
  "STARTING",
  "WAITING_QR",
  "WAITING_FOR_QR",
  "QR",
  "QR_READY",
  "CREATED",
  "INITIALIZING",
  "CONNECTING",
  "LOADING",
  "AUTHENTICATING",
  "OPENING",
]);
const OFFLINE_STATUSES = new Set(["STOPPED", "DISCONNECTED", "CLOSED", "LOGGED_OUT", "LOGOUT", "OFFLINE"]);

export type WahaUiStatus = "ready" | "initializing" | "error" | "disconnected";
export type WahaRelayStatus = "pending" | "connecting" | "active" | "paused" | "offline" | "error";

function normalized(raw: unknown) {
  return String(raw ?? "").trim().toUpperCase();
}

export function normalizeWahaUiStatus(raw: unknown): WahaUiStatus {
  const status = normalized(raw);
  if (READY_STATUSES.has(status)) return "ready";
  if (ERROR_STATUSES.has(status)) return "error";
  if (INITIALIZING_STATUSES.has(status)) return "initializing";
  return "disconnected";
}

export function normalizeWahaRelayStatus(raw: unknown): WahaRelayStatus {
  const status = normalized(raw);
  if (status === "PAUSED") return "paused";
  if (READY_STATUSES.has(status)) return "active";
  if (ERROR_STATUSES.has(status)) return "error";
  if (OFFLINE_STATUSES.has(status)) return "offline";
  if (status === "PENDING") return "pending";
  return "connecting";
}
