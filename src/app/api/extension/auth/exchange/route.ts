import { NextResponse } from "next/server";
import { exchangeExtensionCode } from "@/features/browser-extension/auth";
import { requireExtensionAccess } from "@/features/browser-extension/access";
import { extensionDeviceSchema } from "@/features/browser-extension/schemas";
import { extensionErrorResponse } from "@/features/browser-extension/http";
import { exchangeFailures, ExtensionRateLimitError, ipDoCliente } from "@/features/browser-extension/rate-limit";
import { AuthenticationError } from "@/shared/auth/errors";
export async function POST(request: Request) {
  const ip = ipDoCliente(request);
  try {
    exchangeFailures.verificar(ip);
    const { grant } = await requireExtensionAccess(request, "EXCHANGE_CODE");
    if (!grant) throw new AuthenticationError("Código inválido.");
    const input = extensionDeviceSchema.parse(await request.json());
    return NextResponse.json(await exchangeExtensionCode(input, grant), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Qualquer falha conta no IP. O bloqueio por IP não se conta de novo.
    if (!(error instanceof ExtensionRateLimitError)) exchangeFailures.registrarFalha(ip);
    return extensionErrorResponse(error);
  }
}
