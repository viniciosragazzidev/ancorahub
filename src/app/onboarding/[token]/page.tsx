import { redirect } from "next/navigation";

const BUGGY_PREFIX = "%7B%7Bid%7D%7D";

export function extractRealToken(token: string): string {
  // Detecta token com prefixo codificado do modelo meta bugado: %7B%7Bid%7D%7DJ635b...
  if (token.startsWith(BUGGY_PREFIX)) {
    return token.slice(BUGGY_PREFIX.length);
  }
  return token;
}

export default async function OnboardingTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const realToken = extractRealToken(token);
  redirect(`/onboarding?token=${encodeURIComponent(realToken)}`);
}
