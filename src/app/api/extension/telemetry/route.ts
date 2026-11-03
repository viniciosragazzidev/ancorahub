import { NextResponse } from "next/server";
import { z } from "zod";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { extensionErrorResponse } from "@/features/browser-extension/http";
const telemetrySchema = z.object({ event: z.string().trim().min(1).max(80),
  success: z.boolean().optional(), reason: z.string().trim().max(120).optional(),
  extensionVersion: z.string().trim().max(32).optional() });
export async function POST(request: Request) {
  try {
    const { session } = await requireExtensionAccess(request, "VIEW_LEAD");
    const input = telemetrySchema.parse(await request.json());
    await recordExtensionAudit(`extension.telemetry.${input.event}`, session, { metadata: { success: input.success } });
    return NextResponse.json({ success: true });
  } catch (error) { return extensionErrorResponse(error); }
}
