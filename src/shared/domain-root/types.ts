/**
 * Domain Root Governance Types
 *
 * Foundational, framework-agnostic types for domain definitions, strategy
 * registries, controlled extensions, effective configuration resolution,
 * version lifecycle, and decision provenance.
 */

/**
 * Hierarchical levels where domain configurations or overrides can exist.
 * Absence of explicit authorization at a level means OVERRIDE NOT ALLOWED (deny-by-default).
 */
export type DomainLevel = "SYSTEM" | "TENANT" | "UNIT" | "TEAM" | "USER";

/**
 * Resolution strategies for computing effective values across the scope hierarchy.
 */
export type ResolutionStrategy =
  | "ROOT_ONLY"
  | "NEAREST_OVERRIDE_WINS"
  | "RESTRICTIVE_INTERSECTION"
  | "MERGE";

/**
 * Criticality of a configuration property or domain.
 * - SIMPLE: Save = immediate application (direct/safe settings).
 * - CRITICAL: Requires Draft -> Validation -> Publication lifecycle (operational/financial rules).
 */
export type ConfigCriticality = "SIMPLE" | "CRITICAL";

/**
 * Scope context provided during resolution.
 * Supports multi-unit managers via `unitIds` list without breaking single-unit contracts.
 */
export interface DomainScopeContext {
  tenantId?: string | null;
  /** Primary unit or multi-unit set for managers */
  unitIds?: string[] | null;
  teamId?: string | null;
  userId?: string | null;
}

/**
 * Traceability provenance explaining exactly where a resolved value originated.
 */
export interface Provenance {
  level: DomainLevel;
  sourceId?: string | null;
  version?: number | null;
  appliedStrategy?: ResolutionStrategy | null;
}

/**
 * Individual value wrapped with its provenance.
 */
export interface EffectiveValue<T> {
  value: T;
  provenance: Provenance;
}

/**
 * Complete resolved effective configuration with per-property provenance
 * and list of all applied scope version IDs.
 */
export interface EffectiveConfiguration<TConfig extends Record<string, unknown>> {
  config: Readonly<TConfig>;
  provenanceMap: Readonly<{ [K in keyof TConfig]?: Provenance }>;
  contractVersion: number;
  appliedVersions: ReadonlyArray<{
    level: DomainLevel;
    versionId: string;
    versionNumber: number;
  }>;
}

/**
 * Specification for a single property within a Domain Root Definition.
 */
export interface DomainPropertySpec<TValue = unknown> {
  key: string;
  resolutionStrategy: ResolutionStrategy;
  overrideAllowedAt: DomainLevel[];
  criticality?: ConfigCriticality;
  description?: string;
  validator?: (value: TValue) => { valid: boolean; error?: string };
  /** Explicit, predictable merge function for MERGE strategy */
  mergeCustomizer?: (base: TValue, override: TValue) => TValue;
}

/**
 * Invariant rule that must ALWAYS hold true regardless of any override.
 */
export interface DomainInvariant<TConfig extends Record<string, unknown>> {
  name: string;
  description: string;
  check: (
    config: TConfig,
    context?: DomainScopeContext,
  ) => { valid: boolean; reason?: string };
}

/**
 * Strategy registration definition for registered domain algorithms.
 */
export interface DomainStrategySpec<TStrategyConfig = unknown> {
  key: string;
  technicalLabel: string;
  description?: string;
  configSchema?: {
    validate: (input: unknown) => { valid: boolean; error?: string };
  };
  capabilities?: string[];
  validator?: (config: TStrategyConfig) => { valid: boolean; error?: string };
}
