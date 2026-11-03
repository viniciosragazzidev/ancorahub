import { extensionOfferResponse } from "@/features/browser-extension/offer-route";
export async function POST(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  return extensionOfferResponse(request, params, "accept");
}
