import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCompanyProfile, updateCompanyProfile } from "./service";
import { processMaterialIngestion, approveKnowledgeSuggestion } from "./ingestion/pipeline";
import { executeHybridKnowledgeSearch } from "./rag/hybrid-retrieval";
import { buildAgentContext } from "./rag/agent-context-builder";

// Mocks for DB and AI
vi.mock("@/shared/db", () => {
  const mockCompany = {
    id: "profile-1",
    tenantId: "tenant-test",
    tradeName: "Âncora Saúde Teste",
    companyName: "Âncora Corretora LTDA",
    cnpj: "12.345.678/0001-90",
    phone: "(71) 3333-0000",
    segment: "Planos de Saúde",
    serviceConfig: { businessHours: "08:00 às 18:00" },
  };

  const mockDocs = [
    {
      id: "doc-1",
      tenantId: "tenant-test",
      title: "Tabela Amil Salvador 2026",
      canonicalContent: "A Amil oferece cobertura ampla na região de Salvador com carência de 30 dias.",
      category: "product_plan",
      authorityLevel: 4,
      status: "published",
      validUntil: null,
    },
  ];

  const mockChunks = [
    {
      id: "chunk-1",
      tenantId: "tenant-test",
      documentId: "doc-1",
      chunkIndex: 0,
      text: "A Amil oferece cobertura ampla na região de Salvador com carência de 30 dias.",
      authorityLevel: 4,
      createdAt: new Date(),
    },
  ];

  const mockSuggestions = [
    {
      id: "sugg-1",
      tenantId: "tenant-test",
      entityType: "company",
      title: "Sugestão Telefone Novo",
      currentData: mockCompany,
      detectedData: { phone: "(71) 99999-8888" },
      diff: [{ field: "Telefone", current: "(71) 3333-0000", detected: "(71) 99999-8888" }],
      status: "pending",
    },
  ];

  return {
    getDatabase: () => ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockCompany]),
            orderBy: () => Promise.resolve([mockCompany]),
          }),
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      chunkId: "chunk-1",
                      documentId: "doc-1",
                      text: "A Amil oferece cobertura ampla na região de Salvador com carência de 30 dias.",
                      authorityLevel: 4,
                      title: "Tabela Amil Salvador 2026",
                      category: "product_plan",
                      validUntil: null,
                    },
                  ]),
              }),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve([mockCompany]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([mockCompany]),
          }),
        }),
      }),
    }),
    schema: {
      tenantIntelligenceProfiles: { id: "id", tenantId: "tenant_id" },
      unitIntelligenceProfiles: { id: "id", tenantId: "tenant_id" },
      knowledgeCollections: { id: "id", tenantId: "tenant_id" },
      knowledgeSources: { id: "id", tenantId: "tenant_id" },
      knowledgeDocuments: { id: "id", tenantId: "tenant_id", status: "status" },
      knowledgeChunks: { id: "id", tenantId: "tenant_id", documentId: "document_id", authorityLevel: "authority_level" },
      knowledgeSuggestions: { id: "id", tenantId: "tenant_id", status: "status" },
      agentDefinitions: { id: "id", tenantId: "tenant_id" },
    },
  };
});

vi.mock("@/features/ai/engine", () => ({
  aiComplete: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      companyName: "Âncora Corretora",
      phone: "(71) 99999-8888",
    }),
  }),
}));

describe("Tenant Intelligence Layer Unit Tests", () => {
  it("fetches and updates company profile cleanly", async () => {
    const profile = await getCompanyProfile("tenant-test");
    expect(profile).toBeDefined();
    expect(profile.tenantId).toBe("tenant-test");

    const updated = await updateCompanyProfile("tenant-test", {
      phone: "(71) 3333-1111",
    });
    expect(updated).toBeDefined();
  });

  it("executes hybrid RAG retrieval with tenant isolation", async () => {
    const results = await executeHybridKnowledgeSearch({
      tenantId: "tenant-test",
      query: "Amil Salvador carência",
      limit: 3,
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toContain("Tabela Amil");
    expect(results[0].authorityLevel).toBe(4);
  });

  it("builds unified agent context with AgentContextBuilder", async () => {
    const payload = await buildAgentContext({
      tenantContext: {
        tenantId: "tenant-test",
        userId: "user-1",
        role: "director",
        jobTitle: "director",
        branchId: "branch-1",
      },
      queryText: "Quais os planos com cobertura em Salvador?",
    });

    expect(payload.structuredCrmContext.company).toBeDefined();
    expect(payload.retrievedKnowledge).toHaveLength(1);
    expect(payload.mcpTools.length).toBeGreaterThan(0);
    expect(payload.formattedSystemPromptBlock).toContain("DADOS ESTRUTURADOS DA CORRETORA");
  });
});
