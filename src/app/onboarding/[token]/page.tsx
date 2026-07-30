import { redirect } from "next/navigation";

export default async function OnboardingTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/onboarding?token=${encodeURIComponent(token)}`);
}
