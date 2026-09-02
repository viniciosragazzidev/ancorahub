/**
 * Domain Root Governance Foundation
 *
 * Core primitives, types, and services for authoritative domain models,
 * controlled extensions, strategy registries, effective configuration resolution,
 * versioning, and decision traces.
 */

// Error classes and codes
export * from "./errors";

// Core types and interfaces
export * from "./types";

// Strategy registry
export * from "./strategy-registry";

// Controlled extensions
export * from "./extension";

// Effective config & provenance helpers
export * from "./effective-config";

// Root definition contract & factory
export * from "./definition";

// Pure resolver
export * from "./resolver";

// Versioning and publication lifecycle
export * from "./versioning";

// Decision trace & explainability
export * from "./decision-trace";

// Central registry
export * from "./root-registry";

// UI metadata types
export * from "./ui-types";
