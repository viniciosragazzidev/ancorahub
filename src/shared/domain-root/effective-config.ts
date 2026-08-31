/**
 * Effective Configuration & Provenance Helpers
 *
 * Provides utilities to inspect effective values, provenance origins,
 * inheritance status, and UI field metadata.
 */

import type {
  DomainLevel,
  DomainPropertySpec,
  EffectiveConfiguration,
  EffectiveValue,
  Provenance,
} from "./types";

export interface EffectiveFieldMetadata {
  editable: boolean;
  inherited: boolean;
  sourceLevel: DomainLevel;
  sourceId?: string | null;
  sourceVersion?: number | null;
  allowedOverrideLevels: DomainLevel[];
  appliedStrategy: string;
}

/**
 * Extracts a single property's value and provenance as an EffectiveValue wrapper.
 */
export function getEffectiveValue<
  TConfig extends Record<string, unknown>,
  K extends keyof TConfig,
>(
  effectiveConfig: EffectiveConfiguration<TConfig>,
  key: K,
): EffectiveValue<TConfig[K]> {
  return {
    value: effectiveConfig.config[key],
    provenance: effectiveConfig.provenanceMap[key] ?? {
      level: "SYSTEM",
      appliedStrategy: "ROOT_ONLY",
    },
  };
}

/**
 * Determines whether a given property's value was inherited from a higher level
 * relative to the current viewing scope level.
 */
export function isFieldInherited<TConfig extends Record<string, unknown>>(
  effectiveConfig: EffectiveConfiguration<TConfig>,
  key: keyof TConfig,
  currentViewingLevel: DomainLevel,
): boolean {
  const provenance = effectiveConfig.provenanceMap[key];
  if (!provenance) return true;

  const hierarchy: DomainLevel[] = ["SYSTEM", "TENANT", "UNIT", "TEAM", "USER"];
  const sourceIndex = hierarchy.indexOf(provenance.level);
  const currentIndex = hierarchy.indexOf(currentViewingLevel);

  return sourceIndex < currentIndex;
}

/**
 * Computes UI field metadata explaining editability, origin, and allowed levels.
 */
export function computeFieldMetadata<TConfig extends Record<string, unknown>>(
  effectiveConfig: EffectiveConfiguration<TConfig>,
  key: keyof TConfig,
  spec: DomainPropertySpec,
  currentViewingLevel: DomainLevel,
): EffectiveFieldMetadata {
  const provenance = effectiveConfig.provenanceMap[key] ?? {
    level: "SYSTEM",
    appliedStrategy: spec.resolutionStrategy,
  };

  const allowedLevels = spec.overrideAllowedAt ?? [];
  const editable =
    currentViewingLevel === "SYSTEM"
      ? true
      : allowedLevels.includes(currentViewingLevel);

  const inherited = isFieldInherited(effectiveConfig, key, currentViewingLevel);

  return {
    editable,
    inherited,
    sourceLevel: provenance.level,
    sourceId: provenance.sourceId ?? null,
    sourceVersion: provenance.version ?? null,
    allowedOverrideLevels: allowedLevels,
    appliedStrategy: spec.resolutionStrategy,
  };
}

/**
 * Human-readable technical provenance summary for logs and auditing.
 */
export function formatProvenanceSummary(provenance: Provenance): string {
  const parts = [`level=${provenance.level}`];
  if (provenance.sourceId) parts.push(`sourceId=${provenance.sourceId}`);
  if (provenance.version) parts.push(`v${provenance.version}`);
  if (provenance.appliedStrategy) parts.push(`strategy=${provenance.appliedStrategy}`);
  return `[${parts.join(", ")}]`;
}
