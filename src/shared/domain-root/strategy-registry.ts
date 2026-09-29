/**
 * Strategy Registry
 *
 * Enforces controlled, registered domain strategies.
 * UI/Admins cannot create arbitrary logic or ad-hoc rule builders;
 * they can only select and parameterize strategies registered by engineering.
 */

import { DuplicateStrategyError, UnknownStrategyError } from "./errors";
import type { DomainStrategySpec } from "./types";

export class StrategyRegistry<TStrategyConfig = unknown> {
  private readonly strategies = new Map<string, DomainStrategySpec<TStrategyConfig>>();
  readonly domainKey: string;

  constructor(domainKey: string) {
    this.domainKey = domainKey;
  }

  /**
   * Registers a new strategy spec. Rejects duplicate registrations.
   */
  register(spec: DomainStrategySpec<TStrategyConfig>): this {
    if (this.strategies.has(spec.key)) {
      throw new DuplicateStrategyError(this.domainKey, spec.key);
    }
    this.strategies.set(spec.key, Object.freeze({ ...spec }));
    return this;
  }

  /**
   * Retrieves a registered strategy. Throws UnknownStrategyError if not found.
   */
  get(strategyKey: string): DomainStrategySpec<TStrategyConfig> {
    const strategy = this.strategies.get(strategyKey);
    if (!strategy) {
      throw new UnknownStrategyError(this.domainKey, strategyKey);
    }
    return strategy;
  }

  /**
   * Checks if a strategy is registered.
   */
  has(strategyKey: string): boolean {
    return this.strategies.has(strategyKey);
  }

  /**
   * Lists all registered strategies in registration order.
   */
  list(): Array<DomainStrategySpec<TStrategyConfig>> {
    return Array.from(this.strategies.values());
  }

  /**
   * Validates a configuration payload against a strategy's declared schema/validator.
   */
  validateConfig(
    strategyKey: string,
    config: unknown,
  ): { valid: boolean; error?: string } {
    const strategy = this.get(strategyKey);

    if (strategy.configSchema) {
      const schemaResult = strategy.configSchema.validate(config);
      if (!schemaResult.valid) {
        return schemaResult;
      }
    }

    if (strategy.validator) {
      return strategy.validator(config as TStrategyConfig);
    }

    return { valid: true };
  }
}
