import "server-only";

import { z } from "zod";

import { logger } from "@/shared/infra/logger";

const VPS_HEALTH_TIMEOUT_MS = 7_000;

const vpsHealthSchema = z.object({
  status: z.literal("ok"),
  service: z.string().trim().min(1).max(120),
  timestamp: z.string().datetime({ offset: true }),
}).strict();

const vpsInternalPingSchema = z.object({
  ok: z.literal(true),
  service: z.string().trim().min(1).max(120),
}).strict();

export type VpsHealth =
  | {
      status: "online";
      service: string;
      timestamp: string;
      checkedAt: string;
      latencyMs: number;
    }
  | {
      status: "unavailable";
      errorCode: "not_configured" | "invalid_configuration" | "timeout" | "http_error" | "invalid_response" | "network_error";
      checkedAt: string;
      latencyMs: number;
    };

export type VpsInternalPing =
  | {
      status: "online";
      service: string;
      checkedAt: string;
      latencyMs: number;
    }
  | {
      status: "unavailable";
      errorCode: "not_configured" | "invalid_configuration" | "timeout" | "http_error" | "invalid_response" | "network_error";
      checkedAt: string;
      latencyMs: number;
    };

function vpsBaseUrl() {
  const configuredUrl = process.env.VPS_API_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function healthUrl() {
  const baseUrl = vpsBaseUrl();
  return baseUrl ? `${baseUrl}/health` : null;
}

function unavailable(
  errorCode: Extract<VpsHealth, { status: "unavailable" }>["errorCode"],
  startedAt: number,
): VpsHealth {
  return {
    status: "unavailable",
    errorCode,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  };
}

export async function getVpsHealth(): Promise<VpsHealth> {
  const startedAt = Date.now();
  const url = healthUrl();
  if (!url) {
    const errorCode = process.env.VPS_API_URL ? "invalid_configuration" : "not_configured";
    logger.warn("vps_health_unavailable", { errorCode });
    return unavailable(errorCode, startedAt);
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(VPS_HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn("vps_health_unavailable", { errorCode: "http_error", httpStatus: response.status });
      return unavailable("http_error", startedAt);
    }

    const parsed = vpsHealthSchema.safeParse(await response.json());
    if (!parsed.success) {
      logger.warn("vps_health_unavailable", { errorCode: "invalid_response" });
      return unavailable("invalid_response", startedAt);
    }

    const result: VpsHealth = {
      status: "online",
      service: parsed.data.service,
      timestamp: parsed.data.timestamp,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
    logger.info("vps_health_checked", { service: result.service, latencyMs: result.latencyMs });
    return result;
  } catch (error) {
    const errorCode = error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error";
    logger.warn("vps_health_unavailable", { errorCode });
    return unavailable(errorCode, startedAt);
  }
}

function pingUnavailable(
  errorCode: Extract<VpsInternalPing, { status: "unavailable" }>["errorCode"],
  startedAt: number,
): VpsInternalPing {
  return {
    status: "unavailable",
    errorCode,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  };
}

export async function getVpsInternalPing(): Promise<VpsInternalPing> {
  const startedAt = Date.now();
  const baseUrl = vpsBaseUrl();
  const token = process.env.VPS_INTERNAL_API_TOKEN?.trim();
  if (!baseUrl || !token) {
    const errorCode = !process.env.VPS_API_URL || !token ? "not_configured" : "invalid_configuration";
    logger.warn("vps_internal_ping_unavailable", { errorCode });
    return pingUnavailable(errorCode, startedAt);
  }

  try {
    const response = await fetch(`${baseUrl}/internal/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(VPS_HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn("vps_internal_ping_unavailable", { errorCode: "http_error", httpStatus: response.status });
      return pingUnavailable("http_error", startedAt);
    }

    const parsed = vpsInternalPingSchema.safeParse(await response.json());
    if (!parsed.success) {
      logger.warn("vps_internal_ping_unavailable", { errorCode: "invalid_response" });
      return pingUnavailable("invalid_response", startedAt);
    }

    const result: VpsInternalPing = {
      status: "online",
      service: parsed.data.service,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
    logger.info("vps_internal_ping_checked", { service: result.service, latencyMs: result.latencyMs });
    return result;
  } catch (error) {
    const errorCode = error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error";
    logger.warn("vps_internal_ping_unavailable", { errorCode });
    return pingUnavailable(errorCode, startedAt);
  }
}
