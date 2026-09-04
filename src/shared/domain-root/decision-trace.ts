/**
 * Decision Trace & Explainability Contract
 *
 * Captures transparent, non-PII audit trails explaining domain execution decisions:
 * "Por que o sistema decidiu isso?"
 */

import { randomUUID } from "node:crypto";
import type { DomainLevel } from "./types";

export type DecisionOutcome = "ACCEPTED" | "REJECTED" | "SKIPPED" | "MODIFIED";

export interface DecisionStep {
  step: string;
  evaluation: string;
  outcome: DecisionOutcome;
  details?: Record<string, unknown>;
}

export interface DecisionTrace {
  executionId: string;
  domain: string;
  action: string;
  rootContractVersion: number;
  appliedConfigVersions: Array<{
    level: DomainLevel;
    versionId: string;
    versionNumber: number;
  }>;
  effectiveStrategy: string;
  /** Sanitized, PII-free inputs */
  inputs: Record<string, unknown>;
  /** Step-by-step reasoning steps */
  decisions: DecisionStep[];
  /** Sanitized, PII-free result summary */
  result: Record<string, unknown>;
  timestamp: Date;
  durationMs?: number;
}

const PII_SENSITIVE_KEYWORDS = [
  "cpf",
  "phone",
  "telefone",
  "email",
  "token",
  "secret",
  "apikey",
  "password",
  "senha",
  "session",
  "creditcard",
  "message",
  "mensagem",
  "leadpayload",
];

/**
 * Recursively redacts sensitive PII and credential keys from decision trace payloads.
 */
export function sanitizeDecisionPayload(
  data: unknown,
  depth = 0,
): unknown {
  if (depth > 5 || data == null) return data;

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDecisionPayload(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    const isSensitive = PII_SENSITIVE_KEYWORDS.some((kw) => normalizedKey.includes(kw));

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDecisionPayload(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface CreateDecisionTraceInput {
  domain: string;
  action: string;
  rootContractVersion: number;
  appliedConfigVersions?: Array<{
    level: DomainLevel;
    versionId: string;
    versionNumber: number;
  }>;
  effectiveStrategy: string;
  inputs: Record<string, unknown>;
  decisions: DecisionStep[];
  result: Record<string, unknown>;
  durationMs?: number;
}

/**
 * Factory creating a safe, sanitized DecisionTrace instance.
 */
export function createDecisionTrace(input: CreateDecisionTraceInput): DecisionTrace {
  return {
    executionId: randomUUID(),
    domain: input.domain,
    action: input.action,
    rootContractVersion: input.rootContractVersion,
    appliedConfigVersions: input.appliedConfigVersions ?? [],
    effectiveStrategy: input.effectiveStrategy,
    inputs: (sanitizeDecisionPayload(input.inputs) as Record<string, unknown>) ?? {},
    decisions: input.decisions.map((d) => ({
      step: d.step,
      evaluation: d.evaluation,
      outcome: d.outcome,
      details: d.details ? (sanitizeDecisionPayload(d.details) as Record<string, unknown>) : undefined,
    })),
    result: (sanitizeDecisionPayload(input.result) as Record<string, unknown>) ?? {},
    timestamp: new Date(),
    durationMs: input.durationMs,
  };
}
