import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { aiExtractImageText, aiExtractPdfText, VisionNotConfiguredError } from "@/features/ai/vision";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { chunkOperatorText } from "@/features/waha-group-capture/chunk";
import { IMAGE_EXTRACTION_INSTRUCTION, IMAGE_MATERIAL_NOTICE, IMAGE_MIME_TYPES, usableImageText } from "@/features/waha-group-capture/image-text";
import { extractPdfText } from "@/features/waha-group-capture/pdf-text";
import { isExpired, parseMaterialTtlDays, resolveMaterialValidity } from "@/features/waha-group-capture/validity";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { uploadR2Object } from "@/shared/storage/r2-storage";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Below this, the PDF is almost certainly scanned images: it is read by the vision model instead. */
const MIN_PDF_TEXT_CHARS = 200;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Icons, avatars and tiny previews in a group: not worth a vision call. */
const MIN_GROUP_IMAGE_BYTES = 20_000;
/** Authority 2 of 5: a PDF ranks below company rules. */
const PDF_AUTHORITY = 2;
/** Text read from an image (or a scanned page) can have mistakes, so it ranks lowest. */
const IMAGE_AUTHORITY = 1;

export const OPERATOR_FILE_MIME_TYPES: ReadonlySet<string> = new Set(["application/pdf", ...IMAGE_MIME_TYPES]);

export type IngestOutcome =
  | "captured"
  | "duplicate_material"
  | "needs_ocr"
  | "needs_vision"
  | "no_text"
  | "too_large"
  | "too_small"
  | "expired"
  | "unsupported"
  | "error";

export type IngestResult = { status: IngestOutcome; documentId?: string; sourceId?: string };

async function materialValidity(text: string) {
  const ttlDays = parseMaterialTtlDays(await getFeatureFlag(FEATURE_FLAGS.OPERATOR_MATERIAL_TTL_DAYS));
  return resolveMaterialValidity(text, new Date(), ttlDays);
}

/** The same file is often sent again: reuse the material already published. */
async function findKnownMaterial(tenantId: string, hashMd5: string) {
  const [known] = await getDatabase()
    .select({ documentId: schema.knowledgeDocuments.id, sourceId: schema.knowledgeSources.id })
    .from(schema.knowledgeSources)
    .innerJoin(schema.knowledgeDocuments, eq(schema.knowledgeDocuments.sourceId, schema.knowledgeSources.id))
    .where(and(
      eq(schema.knowledgeSources.tenantId, tenantId),
      eq(schema.knowledgeSources.hashMd5, hashMd5),
      eq(schema.knowledgeSources.status, "parsed"),
    ))
    .limit(1);
  return known ?? null;
}

function isPdfFile(mimeType: string, fileName: string) {
  return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

/**
 * Reads, publishes and queues one operator file for cataloguing. Used by the
 * director's upload and by the WhatsApp group capture, so both land in the
 * same catalog the same way.
 */
export async function ingestOperatorFile(input: {
  tenantId: string;
  body: Buffer;
  fileName: string;
  mimeType: string;
  /** Where it came from when R2 is off, e.g. "waha-group:<id>" or "upload". */
  originLabel: string;
  uploadedBy?: string | null;
  /** Group images below 20 KB are icons; a director's upload is always read. */
  skipTinyImages?: boolean;
}): Promise<IngestResult> {
  try {
    const pdf = isPdfFile(input.mimeType, input.fileName);
    if (!pdf && !IMAGE_MIME_TYPES.has(input.mimeType)) return { status: "unsupported" };
    if (input.body.byteLength > (pdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) return { status: "too_large" };
    if (!pdf && input.skipTinyImages && input.body.byteLength < MIN_GROUP_IMAGE_BYTES) return { status: "too_small" };

    const hashMd5 = createHash("md5").update(input.body).digest("hex");
    const known = await findKnownMaterial(input.tenantId, hashMd5);
    if (known) return { status: "duplicate_material", documentId: known.documentId, sourceId: known.sourceId };

    let text: string;
    let fromImage = false;
    try {
      if (pdf) {
        text = (await extractPdfText(new Uint8Array(input.body))).trim();
        if (text.length < MIN_PDF_TEXT_CHARS) {
          // Scanned PDF: the vision model reads the pages.
          text = usableImageText((await aiExtractPdfText({ pdf: new Uint8Array(input.body), instruction: IMAGE_EXTRACTION_INSTRUCTION })).text) ?? "";
          fromImage = true;
          if (!text) return { status: "needs_ocr" };
        }
      } else {
        const read = await aiExtractImageText({ image: new Uint8Array(input.body), mimeType: input.mimeType, instruction: IMAGE_EXTRACTION_INSTRUCTION });
        text = usableImageText(read.text) ?? "";
        fromImage = true;
        if (!text) return { status: "no_text" };
      }
    } catch (error) {
      // No vision provider is a configuration gap, not a failure.
      if (error instanceof VisionNotConfiguredError) return { status: pdf ? "needs_ocr" : "needs_vision" };
      throw error;
    }

    // A table already past its validity must not reach the quote assistant.
    const validity = await materialValidity(text);
    if (isExpired(validity, new Date())) return { status: "expired" };

    const published = await publishOperatorMaterial({
      tenantId: input.tenantId,
      originLabel: input.originLabel,
      uploadedBy: input.uploadedBy ?? null,
      fileName: input.fileName,
      fileType: pdf ? "application/pdf" : input.mimeType,
      body: input.body,
      hashMd5,
      text,
      authorityLevel: fromImage ? IMAGE_AUTHORITY : PDF_AUTHORITY,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      chunkNotice: fromImage ? IMAGE_MATERIAL_NOTICE : undefined,
    });
    if (!published) return { status: "duplicate_material" };
    return { status: "captured", ...published };
  } catch (error) {
    // Log the outcome only, never the file name or its text.
    console.warn("[operator-catalog] ingest_failed", { error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    return { status: "error" };
  }
}

/**
 * Stores the source, the document and its chunks, and the original file when R2
 * is on, and queues the source for cataloguing. Returns null when the same file
 * is already being published: a unique index on the file hash settles two
 * copies that arrive together, and the second stops before doing any work.
 */
async function publishOperatorMaterial(input: {
  tenantId: string;
  originLabel: string;
  uploadedBy: string | null;
  fileName: string;
  fileType: string;
  body: Buffer;
  hashMd5: string;
  text: string;
  authorityLevel: number;
  validFrom: Date | null;
  validUntil: Date | null;
  /** Prepended to every chunk, e.g. the warning on text read from an image. */
  chunkNotice?: string;
}): Promise<{ documentId: string; sourceId: string } | null> {
  const db = getDatabase();
  const sourceId = randomUUID();
  const documentId = randomUUID();

  // Claim the hash first: the first copy wins.
  const [claimed] = await db
    .insert(schema.knowledgeSources)
    .values({
      id: sourceId,
      tenantId: input.tenantId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.body.byteLength,
      fileUrl: input.originLabel,
      hashMd5: input.hashMd5,
      category: OPERATOR_MATERIAL_CATEGORY,
      status: "parsing",
      uploadedBy: input.uploadedBy,
      extractedText: input.text,
    })
    .onConflictDoNothing()
    .returning({ id: schema.knowledgeSources.id });
  if (!claimed) return null;

  try {
    // Keep the original file when R2 is on; otherwise keep only the extracted text.
    if (await isR2StorageEnabled()) {
      const storageKey = `documents/${input.tenantId}/operator-material/${sourceId}-${input.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      await uploadR2Object(storageKey, input.body, input.fileType);
      await db
        .update(schema.knowledgeSources)
        .set({ fileUrl: `r2:${storageKey}`, updatedAt: new Date() })
        .where(eq(schema.knowledgeSources.id, sourceId));
    }

    await db.insert(schema.knowledgeDocuments).values({
      id: documentId,
      tenantId: input.tenantId,
      sourceId,
      title: input.fileName.replace(/\.[^/.]+$/, ""),
      canonicalContent: input.chunkNotice ? `${input.chunkNotice}\n\n${input.text}` : input.text,
      category: OPERATOR_MATERIAL_CATEGORY,
      authorityLevel: input.authorityLevel,
      status: "published",
      version: 1,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
    });

    const chunks = chunkOperatorText(input.text);
    if (chunks.length > 0) {
      await db.insert(schema.knowledgeChunks).values(
        chunks.map((chunkText, chunkIndex) => {
          const text = input.chunkNotice ? `${input.chunkNotice}\n${chunkText}` : chunkText;
          return {
            id: randomUUID(),
            tenantId: input.tenantId,
            documentId,
            chunkIndex,
            text,
            tokenCount: Math.ceil(text.length / 4),
            authorityLevel: input.authorityLevel,
            metadata: {
              category: OPERATOR_MATERIAL_CATEGORY,
              sourceId,
              fileName: input.fileName,
              ...(input.chunkNotice ? { readFrom: "image" } : {}),
            },
          };
        }),
      );
    }

    // Published and searchable now; the catalog job reads it into operator, plans and areas next.
    await db
      .update(schema.knowledgeSources)
      .set({ status: "parsed", catalogStatus: "pending", updatedAt: new Date() })
      .where(eq(schema.knowledgeSources.id, sourceId));

    return { documentId, sourceId };
  } catch (error) {
    // A half-published source would hold the hash and block the same file forever.
    await db.delete(schema.knowledgeDocuments).where(eq(schema.knowledgeDocuments.sourceId, sourceId)).catch(() => undefined);
    await db.delete(schema.knowledgeSources).where(eq(schema.knowledgeSources.id, sourceId)).catch(() => undefined);
    throw error;
  }
}

/** The R2 key of an operator file, or null when only the text was kept. */
export function operatorFileStorageKey(fileUrl: string) {
  if (fileUrl.startsWith("r2:")) return fileUrl.slice(3);
  // Material captured before 2026-10-22 stored the old download link.
  const legacy = fileUrl.match(/[?&]key=([^&]+)/);
  return legacy ? decodeURIComponent(legacy[1]!) : null;
}
