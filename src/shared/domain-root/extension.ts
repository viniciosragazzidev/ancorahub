/**
 * Controlled Extension Contract
 *
 * Implements strict "Deny-by-default" governance for configuration overrides.
 * Properties can only be overridden at scope levels explicitly authorized by the Root contract.
 */

import { OverrideNotAllowedError } from "./errors";
import type { DomainLevel, DomainPropertySpec } from "./types";

export interface ScopeOverride<T = unknown> {
  level: DomainLevel;
  sourceId?: string | null;
  version?: number | null;
  values: Partial<T>;
}

/**
 * Validates that an attempted override at a specific level is authorized by the property spec.
 * Throws OverrideNotAllowedError if unauthorized.
 */
export function assertOverrideAllowed(
  domainKey: string,
  propertyKey: string,
  spec: DomainPropertySpec,
  attemptedLevel: DomainLevel,
): void {
  // SYSTEM/ROOT is the baseline, not an override
  if (attemptedLevel === "SYSTEM") return;

  const allowedLevels = spec.overrideAllowedAt ?? [];
  if (!allowedLevels.includes(attemptedLevel)) {
    throw new OverrideNotAllowedError(
      domainKey,
      propertyKey,
      attemptedLevel,
      allowedLevels,
    );
  }
}

/**
 * Checks whether an override at a specific level is permitted without throwing.
 */
export function isOverrideAllowed(
  spec: DomainPropertySpec,
  attemptedLevel: DomainLevel,
): boolean {
  if (attemptedLevel === "SYSTEM") return true;
  return spec.overrideAllowedAt?.includes(attemptedLevel) ?? false;
}
