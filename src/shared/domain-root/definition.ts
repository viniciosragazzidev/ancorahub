/**
 * Domain Root Definition Contract
 *
 * Contract declaring the authoritative properties, defaults, supported strategies,
 * invariants, criticality, and validation for a domain.
 */

import { StrategyRegistry } from "./strategy-registry";
import type {
  ConfigCriticality,
  DomainInvariant,
  DomainPropertySpec,
  DomainScopeContext,
  DomainStrategySpec,
} from "./types";

export interface DomainRootDefinitionInput<TConfig extends Record<string, unknown>> {
  key: string;
  contractVersion: number;
  defaults: TConfig;
  properties: { [K in keyof TConfig]?: DomainPropertySpec<TConfig[K]> };
  strategies?: Array<DomainStrategySpec<unknown>>;
  criticality?: ConfigCriticality;
  invariants?: Array<DomainInvariant<TConfig>>;
  validate?: (
    config: TConfig,
    context?: DomainScopeContext,
  ) => { valid: boolean; issues?: string[] };
}

export interface DomainRootDefinition<TConfig extends Record<string, unknown>> {
  readonly key: string;
  readonly contractVersion: number;
  readonly defaults: Readonly<TConfig>;
  readonly properties: Readonly<{
    [K in keyof TConfig]: DomainPropertySpec<TConfig[K]>;
  }>;
  readonly strategies: StrategyRegistry;
  readonly criticality: ConfigCriticality;
  readonly invariants: ReadonlyArray<DomainInvariant<TConfig>>;
  validate(
    config: TConfig,
    context?: DomainScopeContext,
  ): { valid: boolean; issues: string[] };
}

/**
 * Creates and freezes a strongly-typed Domain Root Definition.
 */
export function createDomainRoot<TConfig extends Record<string, unknown>>(
  input: DomainRootDefinitionInput<TConfig>,
): DomainRootDefinition<TConfig> {
  const strategyRegistry = new StrategyRegistry(input.key);
  if (input.strategies) {
    for (const strat of input.strategies) {
      strategyRegistry.register(strat);
    }
  }

  // Ensure every key present in defaults has a corresponding property spec
  const builtProperties: Record<string, DomainPropertySpec<unknown>> = {};
  for (const key of Object.keys(input.defaults)) {
    const userSpec = input.properties[key as keyof TConfig] as DomainPropertySpec<unknown> | undefined;
    builtProperties[key] = userSpec ?? {
      key,
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
      criticality: input.criticality ?? "SIMPLE",
    };
  }

  const invariants = Object.freeze([...(input.invariants ?? [])]);

  const definition: DomainRootDefinition<TConfig> = {
    key: input.key,
    contractVersion: input.contractVersion,
    defaults: Object.freeze({ ...input.defaults }),
    properties: Object.freeze(builtProperties) as unknown as Readonly<{
      [K in keyof TConfig]: DomainPropertySpec<TConfig[K]>;
    }>,
    strategies: strategyRegistry,
    criticality: input.criticality ?? "SIMPLE",
    invariants,
    validate(config: TConfig, context?: DomainScopeContext) {
      const issues: string[] = [];

      // 1. Property-level validations
      for (const [propKey, spec] of Object.entries(this.properties)) {
        if (spec.validator) {
          const propValue = (config as Record<string, unknown>)[propKey];
          const result = spec.validator(propValue);
          if (!result.valid && result.error) {
            issues.push(`[${propKey}] ${result.error}`);
          }
        }
      }

      // 2. Invariant checks
      for (const invariant of this.invariants) {
        const invResult = invariant.check(config, context);
        if (!invResult.valid && invResult.reason) {
          issues.push(`[Invariant: ${invariant.name}] ${invResult.reason}`);
        }
      }

      // 3. Domain-level custom validation
      if (input.validate) {
        const customResult = input.validate(config, context);
        if (!customResult.valid && customResult.issues) {
          issues.push(...customResult.issues);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    },
  };

  return Object.freeze(definition);
}
