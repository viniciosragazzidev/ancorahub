import { NextResponse } from "next/server";
import { exchangeExtensionCode } from "@/features/browser-extension/auth";
import { extensionDeviceSchema } from "@/features/browser-extension/schemas";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";

export async function POST(request: Request) {
  try {
    const input = extensionDeviceSchema.parse(await request.json());
    return NextResponse.json(await exchangeExtensionCode(input));
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : error instanceof AuthorizationError ? 403 : 400;
    return NextResponse.json({ error: "EXTENSION_AUTH_FAILED" }, { status });
  }
}
