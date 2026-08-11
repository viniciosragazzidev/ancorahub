import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { aiComplete } from "@/features/ai/engine";

export type CreateAgentInput = {
  name: string;
  slug: string;
  objective: string;
  category?: string;
  modelProvider?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
  allowedTools?: string[];
  allowedCollectionIds?: string[];
  memoryScope?: string;
  outputFormat?: string;
};

export async function getAgentDefinitions(tenantId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.agentDefinitions)
    .where(eq(schema.agentDefinitions.tenantId, tenantId))
    .orderBy(desc(schema.agentDefinitions.createdAt));
}

export async function createAgentDefinition(tenantId: string, input: CreateAgentInput) {
  const db = getDatabase();
  const id = randomUUID();

  const [created] = await db
    .insert(schema.agentDefinitions)
    .values({
      id,
      tenantId,
      name: input.name,
      slug: input.slug.toLowerCase().trim().replace(/\s+/g, "-"),
      objective: input.objective,
      category: input.category || "general",
      modelProvider: input.modelProvider || "groq",
      modelName: input.modelName || "llama-3.3-70b-versatile",
      temperature: String(input.temperature ?? 0.7),
      maxTokens: input.maxTokens || 1024,
      systemPrompt: input.systemPrompt,
      allowedTools: input.allowedTools || [],
      allowedCollectionIds: input.allowedCollectionIds || [],
      memoryScope: input.memoryScope || "conversation",
      outputFormat: input.outputFormat || "markdown",
      version: 1,
      active: true,
    })
    .returning();

  return created;
}

// ─── Agent Evaluation Execution ─────────────────────────────────────────────

export async function runAgentEvaluationSuite(params: {
  tenantId: string;
  agentId: string;
}) {
  const db = getDatabase();
  const startTime = Date.now();

  const [agent] = await db
    .select()
    .from(schema.agentDefinitions)
    .where(and(eq(schema.agentDefinitions.id, params.agentId), eq(schema.agentDefinitions.tenantId, params.tenantId)))
    .limit(1);

  if (!agent) throw new Error("Agente não encontrado.");

  const testCases = await db
    .select()
    .from(schema.evaluationTestCases)
    .where(and(eq(schema.evaluationTestCases.agentId, params.agentId), eq(schema.evaluationTestCases.tenantId, params.tenantId)));

  if (testCases.length === 0) {
    return {
      runId: null,
      totalCases: 0,
      passedCases: 0,
      accuracyRate: "0.0",
      message: "Nenhum caso de teste configurado para este agente.",
    };
  }

  let passed = 0;
  const details = [];

  for (const tc of testCases) {
    try {
      const response = await aiComplete({
        userMessage: `${agent.systemPrompt}\n\nEntrada de Teste: "${tc.inputPrompt}"`,
        temperatureOverride: Number(agent.temperature),
      });

      const responseText = response.text || "";
      const matchesExpected = responseText.toLowerCase().includes(tc.expectedOutput.toLowerCase());
      const containsForbidden = tc.forbiddenOutput ? responseText.toLowerCase().includes(tc.forbiddenOutput.toLowerCase()) : false;

      const isSuccess = matchesExpected && !containsForbidden;
      if (isSuccess) passed++;

      details.push({
        testCaseId: tc.id,
        testName: tc.name,
        passed: isSuccess,
        responseSnippet: responseText.slice(0, 150),
      });
    } catch (err) {
      details.push({
        testCaseId: tc.id,
        testName: tc.name,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const durationMs = Date.now() - startTime;
  const accuracy = ((passed / testCases.length) * 100).toFixed(1);
  const hallucination = (((testCases.length - passed) / testCases.length) * 100).toFixed(1);

  const runId = randomUUID();
  await db.insert(schema.agentEvaluationRuns).values({
    id: runId,
    tenantId: params.tenantId,
    agentId: params.agentId,
    agentVersion: agent.version,
    totalCases: testCases.length,
    passedCases: passed,
    accuracyRate: accuracy,
    hallucinationRate: hallucination,
    avgLatencyMs: Math.round(durationMs / testCases.length),
    totalCostEst: "0.01",
    runDetails: details,
  });

  return {
    runId,
    totalCases: testCases.length,
    passedCases: passed,
    accuracyRate: `${accuracy}%`,
    hallucinationRate: `${hallucination}%`,
    avgLatencyMs: Math.round(durationMs / testCases.length),
  };
}
