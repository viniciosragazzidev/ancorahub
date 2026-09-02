/**
 * Domain Root Governance Errors
 *
 * Explicit domain errors for configuration resolution, strategy validation,
 * version lifecycle, and controlled extensions.
 */

export type DomainRootErrorCode =
  | "UNKNOWN_DOMAIN"
  | "UNKNOWN_STRATEGY"
  | "DUPLICATE_STRATEGY"
  | "INVALID_CONFIGURATION"
  | "OVERRIDE_NOT_ALLOWED"
  | "INVALID_SCOPE"
  | "INVALID_VERSION_STATE"
  | "PUBLICATION_CONFLICT"
  | "INVARIANT_VIOLATION";

export class DomainRootError extends Error {
  readonly code: DomainRootErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: DomainRootErrorCode,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainRootError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnknownDomainError extends DomainRootError {
  constructor(domainKey: string) {
    super(`Domínio desconhecido: "${domainKey}".`, "UNKNOWN_DOMAIN", { domainKey });
    this.name = "UnknownDomainError";
  }
}

export class UnknownStrategyError extends DomainRootError {
  constructor(domainKey: string, strategyKey: string) {
    super(
      `Estratégia "${strategyKey}" não está registrada para o domínio "${domainKey}".`,
      "UNKNOWN_STRATEGY",
      { domainKey, strategyKey },
    );
    this.name = "UnknownStrategyError";
  }
}

export class DuplicateStrategyError extends DomainRootError {
  constructor(domainKey: string, strategyKey: string) {
    super(
      `Estratégia "${strategyKey}" já está registrada no domínio "${domainKey}".`,
      "DUPLICATE_STRATEGY",
      { domainKey, strategyKey },
    );
    this.name = "DuplicateStrategyError";
  }
}

export class InvalidConfigurationError extends DomainRootError {
  constructor(domainKey: string, issues: string[] | string) {
    const issueList = Array.isArray(issues) ? issues : [issues];
    super(
      `Configuração inválida para o domínio "${domainKey}": ${issueList.join("; ")}`,
      "INVALID_CONFIGURATION",
      { domainKey, issues: issueList },
    );
    this.name = "InvalidConfigurationError";
  }
}

export class OverrideNotAllowedError extends DomainRootError {
  constructor(domainKey: string, propertyKey: string, attemptedLevel: string, allowedLevels: string[]) {
    super(
      `Override da propriedade "${propertyKey}" no nível "${attemptedLevel}" não é permitido no domínio "${domainKey}". Níveis autorizados: [${allowedLevels.join(", ")}].`,
      "OVERRIDE_NOT_ALLOWED",
      { domainKey, propertyKey, attemptedLevel, allowedLevels },
    );
    this.name = "OverrideNotAllowedError";
  }
}

export class InvalidScopeError extends DomainRootError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "INVALID_SCOPE", details);
    this.name = "InvalidScopeError";
  }
}

export class InvalidVersionStateError extends DomainRootError {
  constructor(
    versionId: string,
    currentStatus: string,
    targetStatus: string,
    reason?: string,
  ) {
    const reasonMsg = reason ? ` (${reason})` : "";
    super(
      `Transição de estado inválida para versão "${versionId}": de "${currentStatus}" para "${targetStatus}"${reasonMsg}.`,
      "INVALID_VERSION_STATE",
      { versionId, currentStatus, targetStatus, reason },
    );
    this.name = "InvalidVersionStateError";
  }
}

export class PublicationConflictError extends DomainRootError {
  constructor(domainKey: string, scopeKey: string, conflictingVersionId: string) {
    super(
      `Conflito de publicação no domínio "${domainKey}" para o escopo "${scopeKey}". Versão conflitante ativa: "${conflictingVersionId}".`,
      "PUBLICATION_CONFLICT",
      { domainKey, scopeKey, conflictingVersionId },
    );
    this.name = "PublicationConflictError";
  }
}

export class InvariantViolationError extends DomainRootError {
  constructor(domainKey: string, invariantName: string, reason: string) {
    super(
      `Violação de invariante raiz no domínio "${domainKey}" [${invariantName}]: ${reason}`,
      "INVARIANT_VIOLATION",
      { domainKey, invariantName, reason },
    );
    this.name = "InvariantViolationError";
  }
}
