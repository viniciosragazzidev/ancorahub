import { notFound } from "next/navigation";

import { AuthorizationError } from "@/shared/auth/errors";
import { requireCallAncoraAccess } from "@/features/call-ancora/access";
import { CallAncoraSettingsPanel } from "@/features/call-ancora/components/call-ancora-settings";
import { CallAncoraWorkspace } from "@/features/call-ancora/components/call-ancora-workspace";

async function getCallAncoraPageAccess() {
  try {
    return await requireCallAncoraAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }
}

export default async function CallAncoraPage() {
  const { brokerName, flagBypass, canConfigure } = await getCallAncoraPageAccess();
  return (
    <CallAncoraWorkspace
      brokerFirstName={brokerName.trim().split(/\s+/)[0] || "Corretor"}
      canUseTestList={flagBypass}
      settingsSlot={canConfigure ? <CallAncoraSettingsPanel /> : null}
    />
  );
}
