/**
 * Effective Configuration Resolver
 *
 * Pure, deterministic, side-effect-free resolver that computes the effective
 * configuration from Root defaults and authorized scope overrides.
 */

import { assertOverrideAllowed, type ScopeOverride } from "./extension";
import { InvalidConfigurationError } from "./errors";
import type { DomainRootDefinition } from "./definition";
import type {
  DomainLevel,
  DomainPropertySpec,
  DomainScopeContext,
  EffectiveConfiguration,
  Provenance,
} from "./types";

const LEVEL_HIERARCHY: DomainLevel[] = ["USER", "TEAM", "UNIT", "TENANT", "SYSTEM"];

export interface ResolveEffectiveConfigInput<TConfig extends Record<string, unknown>> {
  root: DomainRootDefinition<TConfig>;
  context?: DomainScopeContext;
  overrides?: Array<ScopeOverride<TConfig>>;
}

/**
 * Resolves the effective configuration by combining Root defaults with authorized
 * overrides following per-property resolution strategies.
 *
 * Pure function: does not perform I/O, DB queries, or mutations.
 */
export function resolveEffectiveConfiguration<
  TConfig extends Record<string, unknown>,
>(
  input: ResolveEffectiveConfigInput<TConfig>,
): EffectiveConfiguration<TConfig> {
  const { root, context, overrides = [] } = input;
  const defaults = root.defaults;
  const properties = root.properties;

  const resolvedConfig = { ...defaults } as TConfig;
  const provenanceMap: { [K in keyof TConfig]?: Provenance } = {};
  const appliedVersions: Array<{
    level: DomainLevel;
    versionId: string;
    versionNumber: number;
  }> = [];

  // Index overrides by level for deterministic lookup
  const overridesByLevel = new Map<DomainLevel, ScopeOverride<TConfig>>();
  for (const override of overrides) {
    // Only accept overrides relevant to the scope context if context is provided
    if (context) {
      if (override.level === "TENANT" && context.tenantId && override.sourceId && override.sourceId !== context.tenantId) {
        continue;
      }
      if (override.level === "UNIT" && context.unitIds && override.sourceId && !context.unitIds.includes(override.sourceId)) {
        continue;
      }
      if (override.level === "TEAM" && context.teamId && override.sourceId && override.sourceId !== context.teamId) {
        continue;
      }
      if (override.level === "USER" && context.userId && override.sourceId && override.sourceId !== context.userId) {
        continue;
      }
    }

    overridesByLevel.set(override.level, override);
    if (override.sourceId && override.version != null) {
      appliedVersions.push({
        level: override.level,
        versionId: override.sourceId,
        versionNumber: override.version,
      });
    }
  }

  // Iterate over each declared property
  for (const key of Object.keys(defaults) as Array<keyof TConfig>) {
    const spec = properties[key] as DomainPropertySpec;
    const propKey = String(key);

    // 1. Check all provided overrides for this property against allowed levels
    for (const [level, override] of overridesByLevel.entries()) {
      if (override.values[key] !== undefined) {
        assertOverrideAllowed(root.key, propKey, spec, level);
      }
    }

    // 2. Resolve according to resolutionStrategy
    switch (spec.resolutionStrategy) {
      case "ROOT_ONLY": {
        resolvedConfig[key] = defaults[key];
        provenanceMap[key] = {
          level: "SYSTEM",
          appliedStrategy: "ROOT_ONLY",
        };
        break;
      }

      case "NEAREST_OVERRIDE_WINS": {
        let winningValue: unknown = defaults[key];
        let winningProvenance: Provenance = {
          level: "SYSTEM",
          appliedStrategy: "NEAREST_OVERRIDE_WINS",
        };

        for (const level of LEVEL_HIERARCHY) {
          if (level === "SYSTEM") break;
          const override = overridesByLevel.get(level);
          if (override && override.values[key] !== undefined) {
            winningValue = override.values[key];
            winningProvenance = {
              level,
              sourceId: override.sourceId ?? null,
              version: override.version ?? null,
              appliedStrategy: "NEAREST_OVERRIDE_WINS",
            };
            break;
          }
        }

        resolvedConfig[key] = winningValue as TConfig[keyof TConfig];
        provenanceMap[key] = winningProvenance;
        break;
      }

      case "RESTRICTIVE_INTERSECTION": {
        const baseValue = defaults[key];

        if (typeof baseValue === "boolean") {
          // For booleans, false is more restrictive than true (deny-first)
          let effectiveBool = Boolean(baseValue);
          let lastRestrictingLevel: DomainLevel = "SYSTEM";
          let sourceId: string | null = null;
          let version: number | null = null;

          for (const level of [...LEVEL_HIERARCHY].reverse()) {
            const override = overridesByLevel.get(level);
            if (override && override.values[key] !== undefined) {
              const val = Boolean(override.values[key]);
              // If any level turns it false, it stays false
              if (!val) {
                effectiveBool = false;
                lastRestrictingLevel = level;
                sourceId = override.sourceId ?? null;
                version = override.version ?? null;
              }
            }
          }

          resolvedConfig[key] = effectiveBool as TConfig[keyof TConfig];
          provenanceMap[key] = {
            level: lastRestrictingLevel,
            sourceId,
            version,
            appliedStrategy: "RESTRICTIVE_INTERSECTION",
          };
        } else if (Array.isArray(baseValue)) {
          // For arrays, compute set intersection across all levels
          let currentSet = new Set(baseValue);
          let lastLevel: DomainLevel = "SYSTEM";
          let sourceId: string | null = null;
          let version: number | null = null;

          for (const level of [...LEVEL_HIERARCHY].reverse()) {
            const override = overridesByLevel.get(level);
            if (override && Array.isArray(override.values[key])) {
              const overrideArray = override.values[key] as unknown[];
              const overrideSet = new Set(overrideArray);
              currentSet = new Set([...currentSet].filter((x) => overrideSet.has(x)));
              lastLevel = level;
              sourceId = override.sourceId ?? null;
              version = override.version ?? null;
            }
          }

          resolvedConfig[key] = Array.from(currentSet) as unknown as TConfig[keyof TConfig];
          provenanceMap[key] = {
            level: lastLevel,
            sourceId,
            version,
            appliedStrategy: "RESTRICTIVE_INTERSECTION",
          };
        } else {
          // Fallback to nearest override if type is not boolean or array
          resolvedConfig[key] = defaults[key];
          provenanceMap[key] = {
            level: "SYSTEM",
            appliedStrategy: "RESTRICTIVE_INTERSECTION",
          };
        }
        break;
      }

      case "MERGE": {
        const baseValue = defaults[key];
        let merged: unknown =
          typeof baseValue === "object" && baseValue !== null && !Array.isArray(baseValue)
            ? { ...(baseValue as Record<string, unknown>) }
            : baseValue;

        let highestOverridingLevel: DomainLevel = "SYSTEM";
        let sourceId: string | null = null;
        let version: number | null = null;

        // Apply in hierarchy order from SYSTEM up to USER
        for (const level of [...LEVEL_HIERARCHY].reverse()) {
          if (level === "SYSTEM") continue;
          const override = overridesByLevel.get(level);
          if (override && override.values[key] !== undefined) {
            const overrideVal = override.values[key];

            if (spec.mergeCustomizer) {
              merged = spec.mergeCustomizer(merged, overrideVal);
            } else if (
              typeof merged === "object" &&
              merged !== null &&
              typeof overrideVal === "object" &&
              overrideVal !== null &&
              !Array.isArray(merged) &&
              !Array.isArray(overrideVal)
            ) {
              merged = {
                ...(merged as Record<string, unknown>),
                ...(overrideVal as Record<string, unknown>),
              };
            } else {
              merged = overrideVal;
            }

            highestOverridingLevel = level;
            sourceId = override.sourceId ?? null;
            version = override.version ?? null;
          }
        }

        resolvedConfig[key] = merged as TConfig[keyof TConfig];
        provenanceMap[key] = {
          level: highestOverridingLevel,
          sourceId,
          version,
          appliedStrategy: "MERGE",
        };
        break;
      }
    }
  }

  // 3. Domain Validation & Invariant Enforcement
  const validationResult = root.validate(resolvedConfig, context);
  if (!validationResult.valid) {
    throw new InvalidConfigurationError(root.key, validationResult.issues);
  }

  return {
    config: Object.freeze(resolvedConfig),
    provenanceMap: Object.freeze(provenanceMap),
    contractVersion: root.contractVersion,
    appliedVersions: Object.freeze(appliedVersions),
  };
}
