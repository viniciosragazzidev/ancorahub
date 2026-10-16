import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { aiExtractImageText, VisionNotConfiguredError } from "@/features/ai/vision";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { phoneHash } from "@/features/waha-cadence/contract";
import { downloadWahaMedia } from "@/features/waha-cadence/relay-client";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { uploadR2Object } from "@/shared/storage/r2-storage";

import { chunkOperatorText } from "./chunk";
import {
  IMAGE_EXTRACTION_INSTRUCTION,
  IMAGE_MATERIAL_NOTICE,
  IMAGE_MIME_TYPES,
  usableImageText,
} from "./image-text";
import { extractPdfText } from "./pdf-text";
import { isExpired, parseMaterialTtlDays, resolveMaterialValidity } from "./validity";

/**
 * The tenant that has this group active on this number, or null. Capture runs
 * only for active groups, so an unselected group never leaves the chat.
 */
export async function findActiveWahaGroupSource(wahaNumberId: string, groupId: string) {
  const db = getDatabase();
  const [row] = await db
    .select({ tenantId: schema.wahaGroupSources.tenantId })
    .from(schema.wahaGroupSources)
    .where(
      and(
        eq(schema.wahaGroupSources.wahaNumberId, wahaNumberId),
        eq(schema.wahaGroupSources.groupId, groupId),
        eq(schema.wahaGroupSources.active, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Below this, the PDF is almost certainly scanned images and needs OCR, which is not done here. */
const MIN_PDF_TEXT_CHARS = 200;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Icons, avatars and tiny previews: not worth a vision call. */
const MIN_IMAGE_BYTES = 20_000;
/** Authority 2 of 5: a PDF is searchable but ranks below company rules until reviewed. */
const PDF_AUTHORITY = 2;
/** Text read from an image can have mistakes, so it ranks lowest. */
const IMAGE_AUTHORITY = 1;

async function materialValidity(text: string) {
  const ttlDays = parseMaterialTtlDays(await getFeatureFlag(FEATURE_FLAGS.OPERATOR_MATERIAL_TTL_DAYS));
  return resolveMaterialValidity(text, new Date(), ttlDays);
}

export type GroupCaptureOutcome =
  | "disabled"
  | "duplicate"
  | "stored"
  | "captured"
  | "duplicate_material"
  | "needs_ocr"
  | "needs_vision"
  | "no_text"
  | "too_large"
  | "too_small"
  | "expired"
  | "error";

export type GroupCaptureInput = {
  tenantId: string;
  providerMessageId: string;
  groupId: string;
  /** Sender phone digits (the participant). Stored only as a hash. */
  authorPhone?: string;
  messageType: string;
  body: string;
  fileName?: string;
  mimeType?: string;
  /** WAHA file path (`/api/files/...`) fetched through the relay. */
  providerPath?: string;
};

type MaterialResult = { status: GroupCaptureOutcome; documentId?: string };

function isPdf(input: GroupCaptureInput) {
  if (input.messageType !== "document") return false;
  return input.mimeType === "application/pdf" || Boolean(input.fileName?.toLowerCase().endsWith(".pdf"));
}

function isImage(input: GroupCaptureInput) {
  return input.messageType === "image";
}

/**
 * Records one group message and, for PDFs and images, turns the text into
 * published operator material that the quote assistant can search. Never
 * creates a lead.
 */
export async function captureWahaGroupMessage(input: GroupCaptureInput): Promise<GroupCaptureOutcome> {
  // Kill switch, off by default: nothing is read until the platform turns it on.
  if ((await getFeatureFlag(FEATURE_FLAGS.WAHA_GROUP_CAPTURE)) !== "true") return "disabled";

  const db = getDatabase();
  const messageRowId = randomUUID();
  const [row] = await db
    .insert(schema.wahaGroupMessages)
    .values({
      id: messageRowId,
      tenantId: input.tenantId,
      groupId: input.groupId,
      providerMessageId: input.providerMessageId,
      authorPhoneHash: input.authorPhone ? phoneHash(input.authorPhone) : null,
      messageType: input.messageType,
      body: input.body.slice(0, 4000),
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: schema.wahaGroupMessages.id });
  if (!row) return "duplicate";

  const providerPath = input.providerPath;
  if (!providerPath) return "stored";

  let outcome: MaterialResult;
  if (isPdf(input)) outcome = await ingestOperatorPdf(input, providerPath);
  else if (isImage(input)) outcome = await ingestOperatorImage(input, providerPath);
  else return "stored";

  await db
    .update(schema.wahaGroupMessages)
    .set({
      captureStatus: outcome.status,
      knowledgeDocumentId: outcome.documentId ?? null,
    })
    .where(eq(schema.wahaGroupMessages.id, messageRowId));
  return outcome.status;
}

/** The same file is often forwarded again: reuse the material already published. */
async function findKnownMaterial(tenantId: string, hashMd5: string) {
  const db = getDatabase();
  const [known] = await db
    .select({ documentId: schema.knowledgeDocuments.id })
    .from(schema.knowledgeSources)
    .innerJoin(schema.knowledgeDocuments, eq(schema.knowledgeDocuments.sourceId, schema.knowledgeSources.id))
    .where(
      and(
        eq(schema.knowledgeSources.tenantId, tenantId),
        eq(schema.knowledgeSources.hashMd5, hashMd5),
        eq(schema.knowledgeSources.status, "parsed"),
      ),
    )
    .limit(1);
  return known ?? null;
}

async function ingestOperatorPdf(input: GroupCaptureInput, providerPath: string): Promise<MaterialResult> {
  try {
    const file = await downloadWahaMedia(providerPath);
    if (file.body.byteLength > MAX_PDF_BYTES) return { status: "too_large" };

    const hashMd5 = createHash("md5").update(file.body).digest("hex");
    const known = await findKnownMaterial(input.tenantId, hashMd5);
    if (known) return { status: "duplicate_material", documentId: known.documentId };

    const text = (await extractPdfText(new Uint8Array(file.body))).trim();
    if (text.length < MIN_PDF_TEXT_CHARS) return { status: "needs_ocr" };

    // A table already past its validity must not reach the quote assistant.
    const validity = await materialValidity(text);
    if (isExpired(validity, new Date())) return { status: "expired" };

    const documentId = await publishOperatorMaterial({
      tenantId: input.tenantId,
      providerMessageId: input.providerMessageId,
      fileName: input.fileName ?? "material-operadora.pdf",
      fileType: "application/pdf",
      body: file.body,
      hashMd5,
      text,
      authorityLevel: PDF_AUTHORITY,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
    });
    if (!documentId) return { status: "duplicate_material" };
    return { status: "captured", documentId };
  } catch (error) {
    // Log the outcome only, never the phone, the body or the file name.
    console.warn("[waha-group-capture] pdf_failed", {
      error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return { status: "error" };
  }
}

async function ingestOperatorImage(input: GroupCaptureInput, providerPath: string): Promise<MaterialResult> {
  try {
    const file = await downloadWahaMedia(providerPath);
    const declared = input.mimeType?.split(";")[0]?.trim();
    const mimeType = declared && declared !== "application/octet-stream" ? declared : file.contentType;
    if (!IMAGE_MIME_TYPES.has(mimeType)) return { status: "stored" };
    if (file.body.byteLength > MAX_IMAGE_BYTES) return { status: "too_large" };
    if (file.body.byteLength < MIN_IMAGE_BYTES) return { status: "too_small" };

    const hashMd5 = createHash("md5").update(file.body).digest("hex");
    const known = await findKnownMaterial(input.tenantId, hashMd5);
    if (known) return { status: "duplicate_material", documentId: known.documentId };

    let readText: string;
    try {
      readText = (
        await aiExtractImageText({
          image: new Uint8Array(file.body),
          mimeType,
          instruction: IMAGE_EXTRACTION_INSTRUCTION,
        })
      ).text;
    } catch (error) {
      // No vision provider is a configuration gap, not a failure: the image stays recorded.
      if (error instanceof VisionNotConfiguredError) return { status: "needs_vision" };
      throw error;
    }

    const text = usableImageText(readText);
    if (!text) return { status: "no_text" };

    const validity = await materialValidity(text);
    if (isExpired(validity, new Date())) return { status: "expired" };

    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const documentId = await publishOperatorMaterial({
      tenantId: input.tenantId,
      providerMessageId: input.providerMessageId,
      fileName: input.fileName ?? `imagem-grupo-${input.providerMessageId.slice(-8)}.${extension}`,
      fileType: mimeType,
      body: file.body,
      hashMd5,
      text,
      authorityLevel: IMAGE_AUTHORITY,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      chunkNotice: IMAGE_MATERIAL_NOTICE,
    });
    if (!documentId) return { status: "duplicate_material" };
    return { status: "captured", documentId };
  } catch (error) {
    console.warn("[waha-group-capture] image_failed", {
      error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return { status: "error" };
  }
}

/**
 * Stores the source, the document and its chunks, and the original file when R2
 * is on. Returns the document id, or null when the same file is already being
 * published: a unique index on the file hash settles two copies that arrive
 * together, and the second stops before doing any work.
 */
async function publishOperatorMaterial(input: {
  tenantId: string;
  providerMessageId: string;
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
}): Promise<string | null> {
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
      fileUrl: `waha-group:${input.providerMessageId}`,
      hashMd5: input.hashMd5,
      category: OPERATOR_MATERIAL_CATEGORY,
      status: "parsing",
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
        .set({ fileUrl: `/api/documents/download?key=${encodeURIComponent(storageKey)}`, updatedAt: new Date() })
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

    await db
      .update(schema.knowledgeSources)
      .set({ status: "parsed", updatedAt: new Date() })
      .where(eq(schema.knowledgeSources.id, sourceId));

    return documentId;
  } catch (error) {
    // A half-published source would hold the hash and block the same file forever.
    await db.delete(schema.knowledgeDocuments).where(eq(schema.knowledgeDocuments.sourceId, sourceId)).catch(() => undefined);
    await db.delete(schema.knowledgeSources).where(eq(schema.knowledgeSources.id, sourceId)).catch(() => undefined);
    throw error;
  }
}
