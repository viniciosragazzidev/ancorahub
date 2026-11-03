import { NextResponse } from "next/server";
import { exchangeExtensionCode } from "@/features/browser-extension/auth";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionDeviceSchema } from "@/features/browser-extension/schemas";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { AuthenticationError } from "@/shared/auth/errors";
export async function POST(request: Request) {
  try {
    const { grant } = await requireExtensionAccess(request, "EXCHANGE_CODE");
    if (!grant) throw new AuthenticationError("Código inválido.");
    const input = extensionDeviceSchema.parse(await request.json());
    return NextResponse.json(await exchangeExtensionCode(input, grant), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return extensionErrorResponse(error); }
}
