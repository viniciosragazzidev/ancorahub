import "server-only";

import type { PermissionKey } from "./permissions";
import type { AccessContext } from "./access-context";
import type { AuthorizationDecision, ResourceScopeDescriptor } from "./types";
import { AuthorizationService } from "./authorization-service";
import { getSystemSetting } from "@/features/system-settings/queries";

export const AUTH_SHADOW_MODE_FEATURE = "feature_auth_shadow_mode";

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
}

export interface ShadowEvaluationResult {
  legacyAllowed: boolean;
  canonicalDecision: AuthorizationDecision;
  mismatch: boolean;
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

  if (mismatch && (await isAuthShadowModeEnabled())) {
    console.warn(
      JSON.stringify({
        event: "auth_shadow_mismatch",
        operation: input.operationKey,
        legacyAllowed: input.legacyAllowed,
        canonicalAllowed: canonicalDecision.allowed,
        canonicalReason: canonicalDecision.reason,
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
  };
}
