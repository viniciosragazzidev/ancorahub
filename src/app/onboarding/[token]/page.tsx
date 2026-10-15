import { redirect } from "next/navigation";

import { extractRealToken } from "@/features/onboarding/extract-real-token";

export default async function OnboardingTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const realToken = extractRealToken(token);
  redirect(`/onboarding?token=${encodeURIComponent(realToken)}`);
}
