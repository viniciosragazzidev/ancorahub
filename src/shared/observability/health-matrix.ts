/**
 * Health matrix — tracks the status of each external dependency.
 *
 * Dependencies are checked independently and can be DEGRADED without
 * taking down the entire CRM. This module provides:
 *
 * - Status tracking (HEALTHY / DEGRADED / DOWN)
 * - Last error information
 * - Uptime percentage
 * - Health check function for each dependency
 */

import { getDatabase } from "@/shared/db";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────

export type DependencyStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN";

export type DependencyHealth = {
  name: string;
  status: DependencyStatus;
  lastCheckMs: number;
  lastError?: string;
  avgDurationMs: number;
  errorCount: number;
  checkCount: number;
};

export type HealthMatrix = {
  overall: DependencyStatus;
  timestamp: number;
  dependencies: DependencyHealth[];
  uptime: {
    window5m: number;
    window1h: number;
  };
};

// ─── State ────────────────────────────────────────────────────────────

type DepState = {
  name: string;
  status: DependencyStatus;
  lastCheckMs: number;
  lastError?: string;
  durations: number[];
  errors: number;
  checks: number;
  consecutiveErrors: number;
};

const dependencies = new Map<string, DepState>();

function getOrCreateDep(name: string): DepState {
  let dep = dependencies.get(name);
  if (!dep) {
    dep = {
      name,
      status: "UNKNOWN",
      lastCheckMs: 0,
      durations: [],
      errors: 0,
      checks: 0,
      consecutiveErrors: 0,
    };
    dependencies.set(name, dep);
  }
  return dep;
}

const MAX_DURATION_HISTORY = 100;

// ─── Record Functions ─────────────────────────────────────────────────

export function recordSuccess(name: string, durationMs: number): void {
  const dep = getOrCreateDep(name);
  dep.status = "HEALTHY";
  dep.lastCheckMs = Date.now();
  dep.lastError = undefined;
  dep.consecutiveErrors = 0;
  dep.checks++;
  dep.durations.push(durationMs);
  if (dep.durations.length > MAX_DURATION_HISTORY) {
    dep.durations.shift();
  }
}

export function recordError(name: string, durationMs: number, error: string): void {
  const dep = getOrCreateDep(name);
  dep.lastCheckMs = Date.now();
  dep.lastError = error;
  dep.checks++;
  dep.errors++;
  dep.consecutiveErrors++;
  dep.durations.push(durationMs);
  if (dep.durations.length > MAX_DURATION_HISTORY) {
    dep.durations.shift();
  }

  // Classification logic
  if (dep.consecutiveErrors >= 5) {
    dep.status = "DOWN";
  } else if (dep.consecutiveErrors >= 2) {
    dep.status = "DEGRADED";
  }
  // First error stays HEALTHY — could be transient
}

// ─── Active Health Checks ─────────────────────────────────────────────

const DEPS = {
  database: "database",
  auth: "auth",
  meta: "meta",
  openrouter: "openrouter",
  whatsapp: "whatsapp",
  vps: "vps",
  realtime: "realtime",
} as const;

/**
 * Run all health checks. Call periodically (e.g. from /api/health).
 * Each check runs independently — a slow check doesn't block others.
 */
export async function runHealthChecks(): Promise<HealthMatrix> {
  const checks = await Promise.allSettled([
    checkDatabase(),
  ]);

  // Build matrix from dependency states
  const deps: DependencyHealth[] = [];
  for (const dep of dependencies.values()) {
    const avgDurationMs =
      dep.durations.length > 0
        ? Math.round(dep.durations.reduce((a, b) => a + b, 0) / dep.durations.length)
        : 0;

    deps.push({
      name: dep.name,
      status: dep.status,
      lastCheckMs: dep.lastCheckMs,
      lastError: dep.lastError,
      avgDurationMs,
      errorCount: dep.errors,
      checkCount: dep.checks,
    });
  }

  // Overall status = worst dependency status
  const overall = computeOverallStatus(deps);

  return {
    overall,
    timestamp: Date.now(),
    dependencies: deps,
    uptime: {
      window5m: computeUptime(5 * 60 * 1000),
      window1h: computeUptime(60 * 60 * 1000),
    },
  };
}

async function checkDatabase(): Promise<void> {
  const start = Date.now();
  try {
    const db = getDatabase();
    await db.execute(sql`SELECT 1 as ok`);
    recordSuccess(DEPS.database, Date.now() - start);
  } catch (error) {
    recordError(DEPS.database, Date.now() - start, String(error));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function computeOverallStatus(deps: DependencyHealth[]): DependencyStatus {
  const statuses = deps.map((d) => d.status);
  if (statuses.includes("DOWN")) return "DOWN";
  if (statuses.includes("DEGRADED")) return "DEGRADED";
  if (statuses.every((s) => s === "UNKNOWN")) return "UNKNOWN";
  return "HEALTHY";
}

function computeUptime(windowMs: number): number {
  // Simple uptime based on error rate in the window
  const cutoff = Date.now() - windowMs;
  let totalChecks = 0;
  let successChecks = 0;

  for (const dep of dependencies.values()) {
    // Use the most recent checks within window
    if (dep.lastCheckMs >= cutoff) {
      totalChecks += dep.checks;
      successChecks += dep.checks - dep.errors;
    }
  }

  if (totalChecks === 0) return 100; // No data = assume healthy
  return Math.round((successChecks / totalChecks) * 10000) / 100;
}

/**
 * Get health matrix without running fresh checks.
 * Useful for quick reads between check intervals.
 */
export function getHealthMatrix(): HealthMatrix {
  const deps: DependencyHealth[] = [];
  for (const dep of dependencies.values()) {
    const avgDurationMs =
      dep.durations.length > 0
        ? Math.round(dep.durations.reduce((a, b) => a + b, 0) / dep.durations.length)
        : 0;

    deps.push({
      name: dep.name,
      status: dep.status,
      lastCheckMs: dep.lastCheckMs,
      lastError: dep.lastError,
      avgDurationMs,
      errorCount: dep.errors,
      checkCount: dep.checks,
    });
  }

  return {
    overall: computeOverallStatus(deps),
    timestamp: Date.now(),
    dependencies: deps,
    uptime: {
      window5m: computeUptime(5 * 60 * 1000),
      window1h: computeUptime(60 * 60 * 1000),
    },
  };
}

// Export dependency names for external usage
export const HEALTH_DEPS = DEPS;
