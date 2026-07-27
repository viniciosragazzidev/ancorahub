import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateExtensionRequest } from "@/features/browser-extension/auth";
import { getDatabase, schema } from "@/shared/db";
import { AuthenticationError } from "@/shared/auth/errors";

const telemetrySchema = z.object({ event: z.string().trim().min(1).max(80), success: z.boolean().optional(), reason: z.string().trim().max(120).optional(), extensionVersion: z.string().trim().max(32).optional() });

export async function POST(request: Request) {
  try {
    const session = await authenticateExtensionRequest(request);
    const input = telemetrySchema.parse(await request.json());
    await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: session.userId, entidade: "browser_extension", entidadeId: session.id, acao: `extension.telemetry.${input.event}` });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_REQUEST" }, { status: error instanceof AuthenticationError ? 401 : 400 }); }
}
