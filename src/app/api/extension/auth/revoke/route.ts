import { NextResponse } from "next/server";
import { revokeExtensionSession } from "@/features/browser-extension/auth";
import { AuthenticationError } from "@/shared/auth/errors";

export async function POST(request: Request) {
  try { await revokeExtensionSession(request); return NextResponse.json({ success: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof AuthenticationError ? "SESSION_EXPIRED" : "INVALID_REQUEST" }, { status: 401 }); }
}
