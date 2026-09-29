/**
 * Domain Root Registry
 *
 * Central catalog of authoritative Domain Root definitions in the system.
 */

import { UnknownDomainError } from "./errors";
import type { DomainRootDefinition } from "./definition";

export class DomainRootRegistry {
  private readonly roots = new Map<string, DomainRootDefinition<Record<string, unknown>>>();

  /**
   * Registers an authoritative Domain Root.
   */
  register<TConfig extends Record<string, unknown>>(
    root: DomainRootDefinition<TConfig>,
  ): this {
    if (this.roots.has(root.key)) {
      throw new Error(`Domain Root "${root.key}" já foi registrado no catálogo.`);
    }

    if (!Number.isInteger(root.contractVersion) || root.contractVersion < 1) {
      throw new Error(
        `Domain Root "${root.key}" possui contractVersion inválido: ${root.contractVersion}. Deve ser um inteiro >= 1.`,
      );
    }

    this.roots.set(root.key, root as unknown as DomainRootDefinition<Record<string, unknown>>);
    return this;
  }

  /**
   * Retrieves a registered Domain Root by its domain key.
   */
  get<TConfig extends Record<string, unknown> = Record<string, unknown>>(
    domainKey: string,
  ): DomainRootDefinition<TConfig> {
    const root = this.roots.get(domainKey);
    if (!root) {
      throw new UnknownDomainError(domainKey);
    }
    return root as unknown as DomainRootDefinition<TConfig>;
  }

  /**
   * Checks if a domain key is registered.
   */
  has(domainKey: string): boolean {
    return this.roots.has(domainKey);
  }

  /**
   * Lists all registered domain roots.
   */
  list(): Array<DomainRootDefinition<Record<string, unknown>>> {
    return Array.from(this.roots.values());
  }

  /**
   * Clears the registry (primarily for test suite isolation).
   */
  clear(): void {
    this.roots.clear();
  }
}

/** Global singleton registry */
export const domainRootRegistry = new DomainRootRegistry();
