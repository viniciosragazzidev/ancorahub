import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { updateCompanyProfile, upsertUnitProfile } from "../service";
import { aiComplete } from "@/features/ai/engine";

export type MaterialClassification =
  | "company_info"
  | "unit_info"
  | "product_plan"
  | "operator_rules"
  | "commercial_rule"
  | "training_material"
  | "conversation_log"
  | "faq"
  | "internal_policy";

export type IngestionResult = {
  sourceId: string;
  documentId: string;
  classification: MaterialClassification;
  entitiesExtracted: Array<{ type: string; name: string; value?: any }>;
  suggestionCreated: boolean;
  chunksCount: number;
};

/**
 * Structural Ingestion Pipeline:
 * UPLOAD -> Parsing -> Classification -> Entity Extraction -> Normalization ->
 * Conflict Detection -> CRM Update Suggestions -> Canonical Generation -> Chunking -> Embeddings -> Publication
 */
export async function processMaterialIngestion(params: {
  tenantId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  rawText: string;
  userCategoryChoice?: string;
  uploadedByUserId?: string;
}): Promise<IngestionResult> {
  const db = getDatabase();
  const sourceId = randomUUID();

  // 1. Create Knowledge Source record
  await db.insert(schema.knowledgeSources).values({
    id: sourceId,
    tenantId: params.tenantId,
    fileName: params.fileName,
    fileType: params.fileType,
    fileSize: params.rawText.length,
    fileUrl: params.fileUrl,
    category: params.userCategoryChoice || "general",
    status: "parsing",
    uploadedBy: params.uploadedByUserId,
  });

  try {
    // 2. Classify Material via AI if not explicitly categorized
    const classificationPrompt = `Classifique este material comercial da corretora de planos de saúde:
    Conteúdo: "${params.rawText.slice(0, 1500)}"

    Responda apenas com uma das seguintes chaves:
    company_info, unit_info, product_plan, operator_rules, commercial_rule, training_material, conversation_log, faq, internal_policy`;

    const classificationResponse = await aiComplete({
      userMessage: classificationPrompt,
      temperatureOverride: 0.1,
    });

    const classification = (classificationResponse.text.trim().toLowerCase() as MaterialClassification) || "company_info";

    // 3. Extract Entities & Detect CRM Modifications
    const entityPrompt = `Analise o documento e extraia entidades estruturadas em JSON válido:
    {
      "companyName": "string ou null",
      "tradeName": "string ou null",
      "cnpj": "string ou null",
      "phone": "string ou null",
      "email": "string ou null",
      "addressCity": "string ou null",
      "businessHours": "string ou null",
      "unitName": "string ou null"
    }
    Documento: "${params.rawText.slice(0, 2000)}"`;

    let extractedData: any = {};
    try {
      const entityResponse = await aiComplete({ userMessage: entityPrompt, temperatureOverride: 0.1 });
      const jsonMatch = entityResponse.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.warn("[Ingestion Pipeline] Failed to parse entity JSON:", err);
    }

    // 4. Generate Suggestion with Visual Diff if CRM data detected
    let suggestionCreated = false;
    if (extractedData.companyName || extractedData.phone || extractedData.cnpj || extractedData.unitName) {
      const currentProfile = await db
        .select()
        .from(schema.tenantIntelligenceProfiles)
        .where(eq(schema.tenantIntelligenceProfiles.tenantId, params.tenantId))
        .limit(1);

      const current = currentProfile[0] || {};
      const diff = [];

      if (extractedData.phone && extractedData.phone !== current.phone) {
        diff.push({ field: "Telefone", current: current.phone || "Não informado", detected: extractedData.phone });
      }
      if (extractedData.cnpj && extractedData.cnpj !== current.cnpj) {
        diff.push({ field: "CNPJ", current: current.cnpj || "Não informado", detected: extractedData.cnpj });
      }

      if (diff.length > 0 || extractedData.unitName) {
        await db.insert(schema.knowledgeSuggestions).values({
          id: randomUUID(),
          tenantId: params.tenantId,
          sourceId,
          entityType: extractedData.unitName ? "unit" : "company",
          title: `Sugestão de atualização: ${extractedData.unitName ? `Unidade ${extractedData.unitName}` : "Dados da Corretora"}`,
          currentData: current,
          detectedData: extractedData,
          diff,
          status: "pending",
        });
        suggestionCreated = true;
      }
    }

    // 5. Generate Canonical Knowledge Document
    const documentId = randomUUID();
    const canonicalPrompt = `Sintetize este documento em um texto de conhecimento canônico claro, factual e otimizado para retrieval de IA (sem saudações ou metáforas):
    Documento: "${params.rawText}"`;

    const canonicalResponse = await aiComplete({ userMessage: canonicalPrompt, temperatureOverride: 0.2 });
    const canonicalContent = canonicalResponse.text || params.rawText;

    await db.insert(schema.knowledgeDocuments).values({
      id: documentId,
      tenantId: params.tenantId,
      sourceId,
      title: params.fileName.replace(/\.[^/.]+$/, ""),
      canonicalContent,
      category: classification,
      authorityLevel: classification === "internal_policy" ? 5 : classification === "company_info" ? 4 : 3,
      status: "published",
      version: 1,
    });

    // 6. Structural Chunking (Split by logical sections / paragraphs)
    const textChunks = canonicalContent
      .split(/\n\n+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 30);

    let chunkIndex = 0;
    for (const chunkText of textChunks) {
      await db.insert(schema.knowledgeChunks).values({
        id: randomUUID(),
        tenantId: params.tenantId,
        documentId,
        chunkIndex,
        text: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4),
        authorityLevel: classification === "internal_policy" ? 5 : 3,
        metadata: { classification, sourceId, fileName: params.fileName },
      });
      chunkIndex++;
    }

    // Update Knowledge Source status to parsed
    await db
      .update(schema.knowledgeSources)
      .set({ status: "parsed", updatedAt: new Date() })
      .where(eq(schema.knowledgeSources.id, sourceId));

    return {
      sourceId,
      documentId,
      classification,
      entitiesExtracted: Object.entries(extractedData).map(([k, v]) => ({ type: k, name: String(v) })),
      suggestionCreated,
      chunksCount: textChunks.length,
    };
  } catch (error) {
    await db
      .update(schema.knowledgeSources)
      .set({
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(eq(schema.knowledgeSources.id, sourceId));

    throw error;
  }
}

// ─── Human Approval of CRM Suggestions ─────────────────────────────────────

export async function approveKnowledgeSuggestion(params: {
  tenantId: string;
  suggestionId: string;
  reviewedByUserId: string;
}) {
  const db = getDatabase();
  const [suggestion] = await db
    .select()
    .from(schema.knowledgeSuggestions)
    .where(
      and(
        eq(schema.knowledgeSuggestions.id, params.suggestionId),
        eq(schema.knowledgeSuggestions.tenantId, params.tenantId)
      )
    )
    .limit(1);

  if (!suggestion) throw new Error("Sugestão não encontrada.");

  const detected = suggestion.detectedData as any;

  if (suggestion.entityType === "company") {
    await updateCompanyProfile(params.tenantId, {
      companyName: detected.companyName || undefined,
      tradeName: detected.tradeName || undefined,
      cnpj: detected.cnpj || undefined,
      phone: detected.phone || undefined,
      email: detected.email || undefined,
    });
  } else if (suggestion.entityType === "unit" && detected.unitName) {
    await upsertUnitProfile(params.tenantId, {
      branchId: randomUUID(),
      unitName: detected.unitName,
      phone: detected.phone,
      addressCity: detected.addressCity,
    });
  }

  await db
    .update(schema.knowledgeSuggestions)
    .set({
      status: "approved",
      reviewedBy: params.reviewedByUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.knowledgeSuggestions.id, params.suggestionId));

  return { success: true, suggestionId: params.suggestionId };
}
