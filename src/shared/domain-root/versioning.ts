/**
 * Domain Versioning & Publication Lifecycle
 *
 * Implements draft -> validated -> published -> archived lifecycle,
 * concurrency-aware publication, and repository interfaces.
 */

import { randomUUID } from "node:crypto";
import {
  InvalidConfigurationError,
  InvalidVersionStateError,
} from "./errors";
import type { DomainRootDefinition } from "./definition";
import type { DomainLevel } from "./types";

export type DomainVersionStatus = "DRAFT" | "VALIDATED" | "PUBLISHED" | "ARCHIVED";

export interface DomainVersion<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  domainKey: string;
  scopeLevel: DomainLevel;
  scopeId?: string | null;
  version: number;
  status: DomainVersionStatus;
  config: Partial<TConfig>;
  contractVersion: number;
  createdBy: string;
  createdAt: Date;
  validatedAt?: Date | null;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  supersedesVersionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DomainVersionRepository<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  save(version: DomainVersion<TConfig>): Promise<void>;
  findById(id: string): Promise<DomainVersion<TConfig> | null>;
  findActivePublished(
    domainKey: string,
    scopeLevel: DomainLevel,
    scopeId?: string | null,
  ): Promise<DomainVersion<TConfig> | null>;
  findLatest(
    domainKey: string,
    scopeLevel: DomainLevel,
    scopeId?: string | null,
  ): Promise<DomainVersion<TConfig> | null>;
  list(
    domainKey: string,
    scopeLevel: DomainLevel,
    scopeId?: string | null,
  ): Promise<Array<DomainVersion<TConfig>>>;
}

/**
 * Reference In-Memory Repository for testing, edge workers, and pure environments.
 */
export class InMemoryDomainVersionRepository<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> implements DomainVersionRepository<TConfig> {
  private readonly storage = new Map<string, DomainVersion<TConfig>>();

  private buildKey(domainKey: string, scopeLevel: DomainLevel, scopeId?: string | null): string {
    return `${domainKey}:${scopeLevel}:${scopeId ?? "root"}`;
  }

  async save(version: DomainVersion<TConfig>): Promise<void> {
    this.storage.set(version.id, Object.freeze({ ...version }));
  }

  async findById(id: string): Promise<DomainVersion<TConfig> | null> {
    const item = this.storage.get(id);
    return item ? { ...item } : null;
  }

  async findActivePublished(
    domainKey: string,
    scopeLevel: DomainLevel,
    scopeId?: string | null,
  ): Promise<DomainVersion<TConfig> | null> {
    for (const item of this.storage.values()) {
      if (
        item.domainKey === domainKey &&
        item.scopeLevel === scopeLevel &&
        (item.scopeId ?? null) === (scopeId ?? null) &&
        item.status === "PUBLISHED"
      ) {
        return { ...item };
      }
    }
    return null;
  }

  async findLatest(
    domainKey: string,
    scopeLevel: DomainLevel,
    scopeId?: string | null,
  ): Promise<DomainVersion<TConfig> | null> {
    const matches = (await this.list(domainKey, scopeLevel, scopeId)).sort(
      (a, b) => b.version - a.version,
    );
    return matches[0] ?? null;
  }

  async list(
    domainKey: string,
    scopeLevel: DomainLevel,
    scopeId?: string | null,
  ): Promise<Array<DomainVersion<TConfig>>> {
    const results: Array<DomainVersion<TConfig>> = [];
    for (const item of this.storage.values()) {
      if (
        item.domainKey === domainKey &&
        item.scopeLevel === scopeLevel &&
        (item.scopeId ?? null) === (scopeId ?? null)
      ) {
        results.push({ ...item });
      }
    }
    return results.sort((a, b) => a.version - b.version);
  }
}

export interface CreateDraftInput<TConfig extends Record<string, unknown>> {
  domainKey: string;
  scopeLevel: DomainLevel;
  scopeId?: string | null;
  config: Partial<TConfig>;
  createdBy: string;
  contractVersion?: number;
  supersedesVersionId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Lifecycle Service managing creation, validation, publication, and archiving of versions.
 */
export class DomainVersionService<TConfig extends Record<string, unknown>> {
  constructor(
    private readonly repository: DomainVersionRepository<TConfig>,
    private readonly root: DomainRootDefinition<TConfig>,
  ) {}

  async createDraft(input: CreateDraftInput<TConfig>): Promise<DomainVersion<TConfig>> {
    const latest = await this.repository.findLatest(
      input.domainKey,
      input.scopeLevel,
      input.scopeId,
    );

    const nextVersionNumber = (latest?.version ?? 0) + 1;
    const version: DomainVersion<TConfig> = {
      id: randomUUID(),
      domainKey: input.domainKey,
      scopeLevel: input.scopeLevel,
      scopeId: input.scopeId ?? null,
      version: nextVersionNumber,
      status: "DRAFT",
      config: input.config,
      contractVersion: input.contractVersion ?? this.root.contractVersion,
      createdBy: input.createdBy,
      createdAt: new Date(),
      supersedesVersionId: input.supersedesVersionId ?? latest?.id ?? null,
      metadata: input.metadata,
    };

    await this.repository.save(version);
    return version;
  }

  async validateDraft(versionId: string): Promise<DomainVersion<TConfig>> {
    const version = await this.repository.findById(versionId);
    if (!version) {
      throw new InvalidVersionStateError(versionId, "NON_EXISTENT", "VALIDATED", "Versão não encontrada");
    }

    if (version.status !== "DRAFT" && version.status !== "VALIDATED") {
      throw new InvalidVersionStateError(versionId, version.status, "VALIDATED");
    }

    // Merge with defaults to validate complete structure
    const completeConfig = { ...this.root.defaults, ...version.config } as TConfig;
    const validationResult = this.root.validate(completeConfig);

    if (!validationResult.valid) {
      throw new InvalidConfigurationError(this.root.key, validationResult.issues);
    }

    const updated: DomainVersion<TConfig> = {
      ...version,
      status: "VALIDATED",
      validatedAt: new Date(),
    };

    await this.repository.save(updated);
    return updated;
  }

  async publish(versionId: string): Promise<DomainVersion<TConfig>> {
    const version = await this.repository.findById(versionId);
    if (!version) {
      throw new InvalidVersionStateError(versionId, "NON_EXISTENT", "PUBLISHED", "Versão não encontrada");
    }

    // For CRITICAL domain configurations, require explicit VALIDATED state before publishing
    if (this.root.criticality === "CRITICAL" && version.status !== "VALIDATED") {
      throw new InvalidVersionStateError(
        versionId,
        version.status,
        "PUBLISHED",
        "Configurações críticas exigem validação prévia antes da publicação (DRAFT -> VALIDATED -> PUBLISHED)",
      );
    }

    // For SIMPLE configurations, auto-validate if still in DRAFT
    if (version.status === "DRAFT") {
      const validated = await this.validateDraft(versionId);
      version.status = validated.status;
      version.validatedAt = validated.validatedAt;
    }

    // Archive current active published version for this scope
    const currentActive = await this.repository.findActivePublished(
      version.domainKey,
      version.scopeLevel,
      version.scopeId,
    );

    if (currentActive && currentActive.id !== version.id) {
      const archived: DomainVersion<TConfig> = {
        ...currentActive,
        status: "ARCHIVED",
        archivedAt: new Date(),
      };
      await this.repository.save(archived);
    }

    const published: DomainVersion<TConfig> = {
      ...version,
      status: "PUBLISHED",
      publishedAt: new Date(),
    };

    await this.repository.save(published);
    return published;
  }

  async archive(versionId: string): Promise<DomainVersion<TConfig>> {
    const version = await this.repository.findById(versionId);
    if (!version) {
      throw new InvalidVersionStateError(versionId, "NON_EXISTENT", "ARCHIVED", "Versão não encontrada");
    }

    const archived: DomainVersion<TConfig> = {
      ...version,
      status: "ARCHIVED",
      archivedAt: new Date(),
    };

    await this.repository.save(archived);
    return archived;
  }
}
