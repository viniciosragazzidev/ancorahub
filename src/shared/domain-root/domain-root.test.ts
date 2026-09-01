import { describe, expect, it } from "vitest";
import {
  createDomainRoot,
  createDecisionTrace,
  DomainVersionService,
  DuplicateStrategyError,
  InMemoryDomainVersionRepository,
  InvalidConfigurationError,
  InvalidVersionStateError,
  OverrideNotAllowedError,
  resolveEffectiveConfiguration,
  UnknownStrategyError,
  getEffectiveValue,
  computeFieldMetadata,
  isFieldInherited,
  type ScopeOverride,
} from "./index";

interface DemoDistributionConfig extends Record<string, unknown> {
  strategy: string;
  capacity: number;
  cooldownMinutes: number;
  tenantIsolation: boolean;
  allowedChannels: string[];
  customWeights: { conversion: number; speed: number };
}

function createTestDistributionRoot(criticality: "SIMPLE" | "CRITICAL" = "CRITICAL") {
  return createDomainRoot<DemoDistributionConfig>({
    key: "demo-distribution",
    contractVersion: 1,
    criticality,
    defaults: {
      strategy: "ROUND_ROBIN",
      capacity: 10,
      cooldownMinutes: 5,
      tenantIsolation: true,
      allowedChannels: ["WHATSAPP", "META_ADS", "WEB"],
      customWeights: { conversion: 40, speed: 60 },
    },
    strategies: [
      {
        key: "ROUND_ROBIN",
        technicalLabel: "Distribuição Circular Simples",
      },
      {
        key: "CAPACITY",
        technicalLabel: "Distribuição por Capacidade Livre",
      },
    ],
    properties: {
      strategy: {
        key: "strategy",
        resolutionStrategy: "NEAREST_OVERRIDE_WINS",
        overrideAllowedAt: ["TENANT", "UNIT"],
      },
      capacity: {
        key: "capacity",
        resolutionStrategy: "NEAREST_OVERRIDE_WINS",
        overrideAllowedAt: ["TENANT", "UNIT", "USER"],
        validator: (val: unknown) => ({
          valid: typeof val === "number" && val > 0,
          error: "Capacidade deve ser um número maior que zero",
        }),
      },
      cooldownMinutes: {
        key: "cooldownMinutes",
        resolutionStrategy: "ROOT_ONLY",
        overrideAllowedAt: [], // ROOT_ONLY, overrides forbidden
      },
      tenantIsolation: {
        key: "tenantIsolation",
        resolutionStrategy: "RESTRICTIVE_INTERSECTION",
        overrideAllowedAt: ["TENANT"], // Only Tenant can restrict, but cannot weaken
      },
      allowedChannels: {
        key: "allowedChannels",
        resolutionStrategy: "RESTRICTIVE_INTERSECTION",
        overrideAllowedAt: ["TENANT", "UNIT"],
      },
      customWeights: {
        key: "customWeights",
        resolutionStrategy: "MERGE",
        overrideAllowedAt: ["TENANT", "UNIT"],
        mergeCustomizer: (base: any, override: any) => ({ ...base, ...override }),
      },
    },
    invariants: [
      {
        name: "TENANT_ISOLATION_ALWAYS_ENABLED",
        description: "Isolamento multi-tenant nunca pode ser desativado",
        check: (config) => ({
          valid: config.tenantIsolation === true,
          reason: "tenantIsolation deve permanecer estritamente true",
        }),
      },
      {
        name: "VALID_STRATEGY_SELECTED",
        description: "A estratégia selecionada deve ser uma estratégia registrada",
        check: (config) => {
          const valid = ["ROUND_ROBIN", "CAPACITY"].includes(config.strategy);
          return {
            valid,
            reason: valid ? undefined : `Estratégia inválida: ${config.strategy}`,
          };
        },
      },
    ],
  });
}

describe("Domain Root Architecture Foundation", () => {
  // Test A: ROOT_ONLY - override is rejected if attempted
  it("Test A: ROOT_ONLY rejects overrides at unauthorized levels", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 1,
        values: { cooldownMinutes: 10 },
      },
    ];

    expect(() =>
      resolveEffectiveConfiguration({
        root,
        overrides,
      }),
    ).toThrow(OverrideNotAllowedError);
  });

  // Test B: NEAREST_OVERRIDE_WINS (Root=10 -> Tenant=8 -> Unit=6 -> effective 6 with UNIT provenance)
  it("Test B: NEAREST_OVERRIDE_WINS selects closest scope level (UNIT over TENANT and ROOT)", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 2,
        values: { capacity: 8 },
      },
      {
        level: "UNIT",
        sourceId: "unit-alpha",
        version: 4,
        values: { capacity: 6 },
      },
    ];

    const result = resolveEffectiveConfiguration({
      root,
      context: { tenantId: "tenant-1", unitIds: ["unit-alpha"] },
      overrides,
    });

    expect(result.config.capacity).toBe(6);
    expect(result.provenanceMap.capacity).toEqual({
      level: "UNIT",
      sourceId: "unit-alpha",
      version: 4,
      appliedStrategy: "NEAREST_OVERRIDE_WINS",
    });
  });

  // Test C: Absence of Unit falls back to Tenant (Root=10 -> Tenant=8 -> effective 8 with TENANT provenance)
  it("Test C: Absence of Unit override falls back cleanly to Tenant", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 2,
        values: { capacity: 8 },
      },
    ];

    const result = resolveEffectiveConfiguration({
      root,
      context: { tenantId: "tenant-1" },
      overrides,
    });

    expect(result.config.capacity).toBe(8);
    expect(result.provenanceMap.capacity).toEqual({
      level: "TENANT",
      sourceId: "tenant-1",
      version: 2,
      appliedStrategy: "NEAREST_OVERRIDE_WINS",
    });
  });

  // Test D: Override not allowed throws explicit OverrideNotAllowedError
  it("Test D: Attempting override at unauthorized level throws OverrideNotAllowedError with full details", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "USER",
        sourceId: "user-123",
        version: 1,
        values: { strategy: "CAPACITY" }, // strategy only allowed at TENANT, UNIT
      },
    ];

    expect(() =>
      resolveEffectiveConfiguration({
        root,
        overrides,
      }),
    ).toThrowError(OverrideNotAllowedError);
  });

  // Test E: Unknown strategy throws UnknownStrategyError
  it("Test E: Querying an unknown strategy throws UnknownStrategyError", () => {
    const root = createTestDistributionRoot();
    expect(() => root.strategies.get("NON_EXISTENT_STRATEGY")).toThrow(UnknownStrategyError);
  });

  // Test F: Duplicate strategy throws DuplicateStrategyError
  it("Test F: Registering a duplicate strategy key throws DuplicateStrategyError", () => {
    const root = createTestDistributionRoot();
    expect(() =>
      root.strategies.register({
        key: "ROUND_ROBIN",
        technicalLabel: "Duplicate Strategy",
      }),
    ).toThrow(DuplicateStrategyError);
  });

  // Test G: Invalid config blocks validation / publication with InvalidConfigurationError
  it("Test G: Invalid property value blocks resolution and throws InvalidConfigurationError", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 1,
        values: { capacity: -5 }, // capacity must be > 0
      },
    ];

    expect(() =>
      resolveEffectiveConfiguration({
        root,
        overrides,
      }),
    ).toThrow(InvalidConfigurationError);
  });

  // Test H: Version lifecycle DRAFT -> VALIDATED -> PUBLISHED
  it("Test H: Version lifecycle follows DRAFT -> VALIDATED -> PUBLISHED cleanly", async () => {
    const root = createTestDistributionRoot("CRITICAL");
    const repository = new InMemoryDomainVersionRepository<DemoDistributionConfig>();
    const service = new DomainVersionService(repository, root);

    // 1. Create Draft
    const draft = await service.createDraft({
      domainKey: root.key,
      scopeLevel: "TENANT",
      scopeId: "tenant-1",
      createdBy: "director-user",
      config: { capacity: 15 },
    });

    expect(draft.status).toBe("DRAFT");
    expect(draft.version).toBe(1);

    // 2. Validate Draft
    const validated = await service.validateDraft(draft.id);
    expect(validated.status).toBe("VALIDATED");
    expect(validated.validatedAt).toBeDefined();

    // 3. Publish
    const published = await service.publish(validated.id);
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeDefined();

    // 4. Verify Active Published Version
    const active = await repository.findActivePublished(root.key, "TENANT", "tenant-1");
    expect(active?.id).toBe(published.id);
    expect(active?.config.capacity).toBe(15);
  });

  // Test I: CRITICAL domain rejects direct DRAFT -> PUBLISHED jump without validation
  it("Test I: CRITICAL domain rejects direct publishing from DRAFT state without prior validation", async () => {
    const root = createTestDistributionRoot("CRITICAL");
    const repository = new InMemoryDomainVersionRepository<DemoDistributionConfig>();
    const service = new DomainVersionService(repository, root);

    const draft = await service.createDraft({
      domainKey: root.key,
      scopeLevel: "TENANT",
      scopeId: "tenant-1",
      createdBy: "director-user",
      config: { capacity: 15 },
    });

    await expect(service.publish(draft.id)).rejects.toThrow(InvalidVersionStateError);
  });

  // Test J: SIMPLE domain allows immediate publishing
  it("Test J: SIMPLE domain automatically validates and publishes directly from DRAFT", async () => {
    const root = createTestDistributionRoot("SIMPLE");
    const repository = new InMemoryDomainVersionRepository<DemoDistributionConfig>();
    const service = new DomainVersionService(repository, root);

    const draft = await service.createDraft({
      domainKey: root.key,
      scopeLevel: "TENANT",
      scopeId: "tenant-1",
      createdBy: "director-user",
      config: { capacity: 12 },
    });

    const published = await service.publish(draft.id);
    expect(published.status).toBe("PUBLISHED");
  });

  // Test K: Provenance is accurate and inspectable via helpers
  it("Test K: Provenance helpers correctly report inheritance, field metadata, and effective wrappers", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 3,
        values: { capacity: 20 },
      },
    ];

    const effective = resolveEffectiveConfiguration({
      root,
      context: { tenantId: "tenant-1" },
      overrides,
    });

    const capacityEffective = getEffectiveValue(effective, "capacity");
    expect(capacityEffective.value).toBe(20);
    expect(capacityEffective.provenance.level).toBe("TENANT");

    const isInheritedAtUnit = isFieldInherited(effective, "capacity", "UNIT");
    expect(isInheritedAtUnit).toBe(true);

    const isInheritedAtTenant = isFieldInherited(effective, "capacity", "TENANT");
    expect(isInheritedAtTenant).toBe(false);

    const metadata = computeFieldMetadata(
      effective,
      "capacity",
      root.properties.capacity as any,
      "UNIT",
    );
    expect(metadata.editable).toBe(true);
    expect(metadata.inherited).toBe(true);
    expect(metadata.sourceLevel).toBe("TENANT");
    expect(metadata.sourceVersion).toBe(3);
  });

  // Test L: Deterministic resolution
  it("Test L: Multiple resolution passes produce identical, deterministic results", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 1,
        values: { capacity: 14, strategy: "CAPACITY" },
      },
    ];

    const pass1 = resolveEffectiveConfiguration({ root, overrides });
    const pass2 = resolveEffectiveConfiguration({ root, overrides });

    expect(pass1.config).toEqual(pass2.config);
    expect(pass1.provenanceMap).toEqual(pass2.provenanceMap);
  });

  // Test M: RESTRICTIVE_INTERSECTION
  it("Test M: RESTRICTIVE_INTERSECTION computes set intersection across scopes", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 1,
        values: { allowedChannels: ["WHATSAPP", "META_ADS"] },
      },
      {
        level: "UNIT",
        sourceId: "unit-1",
        version: 1,
        values: { allowedChannels: ["WHATSAPP", "WEB"] },
      },
    ];

    const result = resolveEffectiveConfiguration({
      root,
      context: { tenantId: "tenant-1", unitIds: ["unit-1"] },
      overrides,
    });

    // Intersection of ["WHATSAPP", "META_ADS", "WEB"] ∩ ["WHATSAPP", "META_ADS"] ∩ ["WHATSAPP", "WEB"] = ["WHATSAPP"]
    expect(result.config.allowedChannels).toEqual(["WHATSAPP"]);
    expect(result.provenanceMap.allowedChannels?.appliedStrategy).toBe("RESTRICTIVE_INTERSECTION");
  });

  // Test N: MERGE predictable resolution
  it("Test N: MERGE strategy shallow-merges object overrides predictably", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 1,
        values: { customWeights: { conversion: 70, speed: 60 } },
      },
      {
        level: "UNIT",
        sourceId: "unit-1",
        version: 1,
        values: { customWeights: { speed: 30, conversion: 70 } },
      },
    ];

    const result = resolveEffectiveConfiguration({
      root,
      context: { tenantId: "tenant-1", unitIds: ["unit-1"] },
      overrides,
    });

    expect(result.config.customWeights).toEqual({ conversion: 70, speed: 30 });
    expect(result.provenanceMap.customWeights?.level).toBe("UNIT");
  });

  // Test O: Root invariants cannot be overridden
  it("Test O: Root invariants strictly reject violating overrides", () => {
    const root = createTestDistributionRoot();

    const overrides: Array<ScopeOverride<DemoDistributionConfig>> = [
      {
        level: "TENANT",
        sourceId: "tenant-1",
        version: 1,
        values: { strategy: "UNREGISTERED_STRATEGY" },
      },
    ];

    expect(() =>
      resolveEffectiveConfiguration({
        root,
        overrides,
      }),
    ).toThrow(InvalidConfigurationError);
  });

  // Test P: Publishing archives older active published version
  it("Test P: Publishing a new version automatically archives previous active version", async () => {
    const root = createTestDistributionRoot("SIMPLE");
    const repository = new InMemoryDomainVersionRepository<DemoDistributionConfig>();
    const service = new DomainVersionService(repository, root);

    // Publish v1
    const draft1 = await service.createDraft({
      domainKey: root.key,
      scopeLevel: "TENANT",
      scopeId: "tenant-1",
      createdBy: "user-1",
      config: { capacity: 10 },
    });
    const pub1 = await service.publish(draft1.id);
    expect(pub1.status).toBe("PUBLISHED");

    // Publish v2
    const draft2 = await service.createDraft({
      domainKey: root.key,
      scopeLevel: "TENANT",
      scopeId: "tenant-1",
      createdBy: "user-2",
      config: { capacity: 20 },
    });
    const pub2 = await service.publish(draft2.id);
    expect(pub2.status).toBe("PUBLISHED");

    // Verify v1 is now ARCHIVED
    const oldV1 = await repository.findById(pub1.id);
    expect(oldV1?.status).toBe("ARCHIVED");
    expect(oldV1?.archivedAt).toBeDefined();

    // Verify active is v2
    const active = await repository.findActivePublished(root.key, "TENANT", "tenant-1");
    expect(active?.id).toBe(pub2.id);
    expect(active?.version).toBe(2);
  });

  // Test Q: DecisionTrace PII Redaction and Safe Auditing
  it("Test Q: DecisionTrace automatically redacts sensitive PII keys", () => {
    const trace = createDecisionTrace({
      domain: "demo-distribution",
      action: "assign_lead",
      rootContractVersion: 1,
      effectiveStrategy: "CAPACITY",
      inputs: {
        leadId: "lead-123",
        telefone: "+5511999998888",
        email: "sensivel@cliente.com",
        cpf: "123.456.789-00",
        requestedPlan: "Gold Health",
      },
      decisions: [
        {
          step: "FILTER_ON_DUTY",
          evaluation: "3 corretores de plantão encontrados",
          outcome: "ACCEPTED",
          details: { secretToken: "my-secret-token", brokerCount: 3 },
        },
      ],
      result: {
        assignedBrokerId: "broker-456",
        message: "Mensagem secreta do cliente",
      },
    });

    expect(trace.inputs.leadId).toBe("lead-123");
    expect(trace.inputs.requestedPlan).toBe("Gold Health");
    expect(trace.inputs.telefone).toBe("[REDACTED]");
    expect(trace.inputs.email).toBe("[REDACTED]");
    expect(trace.inputs.cpf).toBe("[REDACTED]");

    expect(trace.decisions[0].details?.secretToken).toBe("[REDACTED]");
    expect(trace.decisions[0].details?.brokerCount).toBe(3);

    expect(trace.result.assignedBrokerId).toBe("broker-456");
    expect(trace.result.message).toBe("[REDACTED]");
  });
});
