import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { getDatabase, schema } from "@/shared/db";
import { AuthenticationError } from "@/shared/auth/errors";

const feedbackSchema = z.object({ useful: z.boolean(), inserted: z.boolean().optional(), copied: z.boolean().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ suggestionId: string }> }) {
  try {
    const session = await authenticateExtensionRequest(request);
    const { suggestionId } = await params;
    const input = feedbackSchema.parse(await request.json());
    await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: session.userId, entidade: "browser_extension_suggestion", entidadeId: suggestionId, acao: input.useful ? "extension.suggestion.useful" : "extension.suggestion.not_useful" });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_REQUEST" }, { status: error instanceof AuthenticationError ? 401 : 400 }); }
}
