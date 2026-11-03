import { NextResponse } from "next/server";
import { AuthorizationError } from "@/shared/auth/errors";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { recordExtensionAudit } from "@/features/browser-extension/audit";
import { listExtensionOffers } from "@/features/browser-extension/offers";

export async function GET(request: Request) {
  try {
    const { session, context } = await requireExtensionAccess(request, "VIEW_LEAD");
    if (context.role !== "broker") throw new AuthorizationError("Somente o corretor pode consultar ofertas.");
    const offers = await listExtensionOffers(context);
    await recordExtensionAudit("extension.offers.listed", session, { metadata: { count: offers.length } });
    return NextResponse.json({ offers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
