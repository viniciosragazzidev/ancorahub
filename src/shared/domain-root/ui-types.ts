/**
 * UI Metadata & Governance Types
 *
 * Framework-agnostic contracts for UI components to query field editability,
 * provenance labels, allowed override scopes, and publication requirements.
 */

import type { ConfigCriticality, DomainLevel } from "./types";

export interface DomainUiFieldDescriptor {
  key: string;
  label: string;
  description?: string;
  editable: boolean;
  inherited: boolean;
  sourceLevel: DomainLevel;
  sourceLabel?: string;
  allowedOverrideLevels: DomainLevel[];
  requiresPublication: boolean;
  activeStrategy?: string;
}

export interface DomainUiFormDescriptor {
  domainKey: string;
  contractVersion: number;
  criticality: ConfigCriticality;
  fields: DomainUiFieldDescriptor[];
}
