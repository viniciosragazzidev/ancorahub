import { createDomainRoot } from "./definition";

export interface ConversationIntelligenceConfig extends Record<string, unknown> {
  enabled: boolean;
  analysisDebounceSeconds: number;
  periodicReconciliationMinutes: number;
  confidenceThresholdAuto: number;
  confidenceThresholdSuggest: number;
  maxRecentMessagesInContext: number;
  autoAllowedTransitions: string[];
  suggestOnlyTransitions: string[];
  systemOnlyTransitions: string[];
  tenantIsolation: boolean;
}

export const conversationIntelligenceDomainRoot = createDomainRoot<ConversationIntelligenceConfig>({
  key: "conversation-intelligence",
  contractVersion: 1,
  criticality: "CRITICAL",
  defaults: {
    enabled: true,
    analysisDebounceSeconds: 45,
    periodicReconciliationMinutes: 120,
    confidenceThresholdAuto: 0.90,
    confidenceThresholdSuggest: 0.70,
    maxRecentMessagesInContext: 12,
    autoAllowedTransitions: [
      "distributed->in_contact",
      "quote_sent->negotiation",
    ],
    suggestOnlyTransitions: [
      "negotiation->documentation_pending",
      "in_contact->quote_sent",
      "any->lost",
    ],
    systemOnlyTransitions: [
      "any->converted",
    ],
    tenantIsolation: true,
  },
  strategies: [
    { key: "SAFE_PROGRESSIVE", technicalLabel: "Progressão Segura com Verificação Determinística" },
    { key: "SUGGEST_ONLY_STRICT", technicalLabel: "Apenas Sugestões (Sem Auto-Transição)" },
    { key: "ASSESSMENT_SHADOW", technicalLabel: "Modo Sombra de Inteligência Conversacional" },
  ],
  properties: {
    enabled: {
      key: "enabled",
      resolutionStrategy: "NEAREST_OVERRIDE_WINS",
      overrideAllowedAt: ["TENANT", "UNIT"],
    },
    analysisDebounceSeconds: {
      key: "analysisDebounceSeconds",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
      validator: (val: unknown) => ({
        valid: typeof val === "number" && val >= 10 && val <= 300,
        error: "analysisDebounceSeconds deve estar entre 10 e 300 segundos",
      }),
    },
    periodicReconciliationMinutes: {
      key: "periodicReconciliationMinutes",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
      validator: (val: unknown) => ({
        valid: typeof val === "number" && val >= 15,
        error: "periodicReconciliationMinutes deve ser no mínimo 15 minutos",
      }),
    },
    confidenceThresholdAuto: {
      key: "confidenceThresholdAuto",
      resolutionStrategy: "RESTRICTIVE_INTERSECTION",
      overrideAllowedAt: ["TENANT"],
      validator: (val: unknown) => ({
        valid: typeof val === "number" && val >= 0.85 && val <= 1.0,
        error: "confidenceThresholdAuto deve ser entre 0.85 e 1.0",
      }),
    },
    confidenceThresholdSuggest: {
      key: "confidenceThresholdSuggest",
      resolutionStrategy: "NEAREST_OVERRIDE_WINS",
      overrideAllowedAt: ["TENANT", "UNIT"],
      validator: (val: unknown) => ({
        valid: typeof val === "number" && val >= 0.50 && val < 0.90,
        error: "confidenceThresholdSuggest deve ser entre 0.50 e 0.89",
      }),
    },
    maxRecentMessagesInContext: {
      key: "maxRecentMessagesInContext",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
    },
    autoAllowedTransitions: {
      key: "autoAllowedTransitions",
      resolutionStrategy: "RESTRICTIVE_INTERSECTION",
      overrideAllowedAt: ["TENANT"],
    },
    suggestOnlyTransitions: {
      key: "suggestOnlyTransitions",
      resolutionStrategy: "NEAREST_OVERRIDE_WINS",
      overrideAllowedAt: ["TENANT"],
    },
    systemOnlyTransitions: {
      key: "systemOnlyTransitions",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
    },
    tenantIsolation: {
      key: "tenantIsolation",
      resolutionStrategy: "ROOT_ONLY",
      overrideAllowedAt: [],
    },
  },
  invariants: [
    {
      name: "CONVERTED_NEVER_AUTO",
      description: "A transição para 'converted' nunca pode ser executada automaticamente pela IA (SYSTEM_ONLY).",
      check: (config) => {
        const hasConvertedInAuto = config.autoAllowedTransitions.some((t) =>
          t.endsWith("->converted") || t.startsWith("converted->"),
        );
        return {
          valid: !hasConvertedInAuto,
          reason: "Nenhuma transição para 'converted' pode ser incluída em autoAllowedTransitions",
        };
      },
    },
    {
      name: "CONFIDENCE_BOUNDS_VALID",
      description: "O limiar de automação deve ser estritamente maior que o limiar de sugestão.",
      check: (config) => ({
        valid: config.confidenceThresholdAuto > config.confidenceThresholdSuggest,
        reason: "confidenceThresholdAuto deve ser estritamente maior que confidenceThresholdSuggest",
      }),
    },
    {
      name: "TENANT_ISOLATION_MANDATORY",
      description: "Isolamento multi-tenant deve permanecer estritamente true.",
      check: (config) => ({
        valid: config.tenantIsolation === true,
        reason: "tenantIsolation não pode ser false",
      }),
    },
  ],
});
