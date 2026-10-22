import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getFeatureFlag } from "@/features/system-settings/queries";
import { ingestOperatorFile } from "@/features/operator-catalog/ingest";
import { phoneHash } from "@/features/waha-cadence/contract";
import { downloadWahaMedia } from "@/features/waha-cadence/relay-client";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

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
  if (isPdf(input)) outcome = await ingestGroupFile(input, providerPath, "pdf");
  else if (isImage(input)) outcome = await ingestGroupFile(input, providerPath, "image");
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

/** Group files go through the same ingestion as the director's uploads (operator-catalog/ingest.ts). */
async function ingestGroupFile(input: GroupCaptureInput, providerPath: string, kind: "pdf" | "image"): Promise<MaterialResult> {
  try {
    const file = await downloadWahaMedia(providerPath);
    const declared = input.mimeType?.split(";")[0]?.trim();
    const mimeType = kind === "pdf" ? "application/pdf" : declared && declared !== "application/octet-stream" ? declared : file.contentType;
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const result = await ingestOperatorFile({
      tenantId: input.tenantId,
      body: file.body,
      fileName: input.fileName ?? (kind === "pdf" ? "material-operadora.pdf" : `imagem-grupo-${input.providerMessageId.slice(-8)}.${extension}`),
      mimeType,
      originLabel: `waha-group:${input.providerMessageId}`,
      skipTinyImages: true,
    });
    // An image type the catalog does not read stays only recorded, as before.
    if (result.status === "unsupported") return { status: "stored" };
    return { status: result.status, documentId: result.documentId };
  } catch (error) {
    // Log the outcome only, never the phone, the body or the file name.
    console.warn("[waha-group-capture] file_failed", { kind, error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    return { status: "error" };
  }
}
