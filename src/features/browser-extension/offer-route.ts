import { NextResponse } from "next/server";
import { AuthorizationError } from "@/shared/auth/errors";
import { requireExtensionAccess } from "./access";
import { extensionErrorResponse } from "./http";
import { extensionOfferIdSchema, respondToExtensionOffer } from "./offers";

export async function extensionOfferResponse(request: Request, params: Promise<{ offerId: string }>, action: "accept" | "decline") {
  try {
    const { session, context } = await requireExtensionAccess(request, "ACCEPT_LEAD");
    if (context.role !== "broker") throw new AuthorizationError("Somente o corretor pode responder à oferta.");
    const offerId = extensionOfferIdSchema.parse((await params).offerId);
    // No body action/phone/tenant is accepted: the route and trusted context decide everything.
    const result = await respondToExtensionOffer(context, session, offerId, action);
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
