import { NextResponse } from "next/server";
import { z } from "zod";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { extensionErrorResponse } from "@/features/browser-extension/http";
const feedbackSchema = z.object({ useful: z.boolean(), inserted: z.boolean().optional(), copied: z.boolean().optional() });
export async function POST(request: Request, { params }: { params: Promise<{ suggestionId: string }> }) {
  try {
    const { session } = await requireExtensionAccess(request, "GENERATE_REPLY");
    const { suggestionId } = await params;
    const input = feedbackSchema.parse(await request.json());
    await recordExtensionAudit(input.useful ? "extension.suggestion.useful" : "extension.suggestion.not_useful", session, { entityId: suggestionId });
    return NextResponse.json({ success: true });
  } catch (error) { return extensionErrorResponse(error); }
}
