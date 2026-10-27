import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

export function dutyShiftReminderSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.DUTY_SHIFT_REMINDER_24H.key}_${tenantId}`;
}

/** Tenant comes from the authenticated/worker context; the pilot is off unless explicitly enabled. */
export async function isDutyShiftReminderEnabled(tenantId: string) {
  const value = await getSystemSetting(dutyShiftReminderSettingKey(tenantId)).catch(() => null);
  return (value ?? FEATURE_FLAGS.DUTY_SHIFT_REMINDER_24H.defaultValue) === "true";
}
