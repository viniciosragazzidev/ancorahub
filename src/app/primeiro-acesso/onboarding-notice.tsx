import { LightAuthShell, LightAuthTitle } from "@/components/light/light-auth-shell";

/** Full-screen notice of the first-access flow (missing, used, expired or unknown invitation), in the Lite frame. */
export function OnboardingNotice({ title, description }: { title: string; description: string }) {
  return (
    <LightAuthShell>
      <LightAuthTitle title={title} description={description} />
    </LightAuthShell>
  );
}
