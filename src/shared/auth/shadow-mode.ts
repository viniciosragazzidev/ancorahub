import "server-only";

import type { PermissionKey } from "./permissions";
import type { AccessContext } from "./access-context";
import type { AuthorizationDecision, ResourceScopeDescriptor } from "./types";
import { AuthorizationService } from "./authorization-service";
import { getSystemSetting } from "@/features/system-settings/queries";

export const AUTH_SHADOW_MODE_FEATURE = "feature_auth_shadow_mode";

export type ShadowMismatchClassification =
  | "LEGACY_TOO_PERMISSIVE"
  | "LEGACY_TOO_RESTRICTIVE"
  | "SCOPE_MODEL_GAP"
  | "CUSTOM_ROLE_GAP"
  | "TEAM_SCOPE_GAP"
  | "QUERY_SCOPE_GAP"
  | "UNKNOWN_BUSINESS_RULE";

export async function isAuthShadowModeEnabled(): Promise<boolean> {
  if (process.env.AUTH_SHADOW_MODE === "true") return true;
  try {
    const value = await getSystemSetting(AUTH_SHADOW_MODE_FEATURE);
    return value === "true";
  } catch {
    return false;
  }
}

export interface ShadowEvaluationInput {
  operationKey: string;
  legacyAllowed: boolean;
  context: AccessContext;
  capability: PermissionKey;
  resource?: ResourceScopeDescriptor | null;
  customMismatchClass?: ShadowMismatchClassification;
}

export interface ShadowEvaluationResult {
  legacyAllowed: boolean;
  canonicalDecision: AuthorizationDecision;
  mismatch: boolean;
  mismatchClassification?: ShadowMismatchClassification;
}

export function classifyShadowMismatch(
  legacyAllowed: boolean,
  canonicalDecision: AuthorizationDecision,
  customClass?: ShadowMismatchClassification,
): ShadowMismatchClassification {
  if (customClass) return customClass;
  if (legacyAllowed && !canonicalDecision.allowed) return "LEGACY_TOO_PERMISSIVE";
  if (!legacyAllowed && canonicalDecision.allowed) return "LEGACY_TOO_RESTRICTIVE";
  return "UNKNOWN_BUSINESS_RULE";
}

/**
 * Executa avaliação em modo sombra (Shadow Evaluation).
 * Compara a decisão legada contra a decisão canônica do AuthorizationService.
 * Registra mismatches em log estruturado seguro sem PII nem secrets.
 */
export async function evaluateShadowAuthorization(
  input: ShadowEvaluationInput,
): Promise<ShadowEvaluationResult> {
  const canonicalDecision = AuthorizationService.evaluate(
    input.context,
    input.capability,
    input.resource,
  );

  const mismatch = input.legacyAllowed !== canonicalDecision.allowed;
  const mismatchClassification = mismatch
    ? classifyShadowMismatch(input.legacyAllowed, canonicalDecision, input.customMismatchClass)
    : undefined;

  if (mismatch && (await isAuthShadowModeEnabled())) {
    console.warn(
      JSON.stringify({
        event: "auth_shadow_mismatch",
        operation: input.operationKey,
        legacyAllowed: input.legacyAllowed,
        canonicalAllowed: canonicalDecision.allowed,
        canonicalReason: canonicalDecision.reason,
        mismatchClass: mismatchClassification,
        scopeType: input.context.scopeType,
        scopeProvenance: input.context.scope?.provenance?.units,
        matchedScope: canonicalDecision.matchedScope,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  return {
    legacyAllowed: input.legacyAllowed,
    canonicalDecision,
    mismatch,
    mismatchClassification,
  };
}
