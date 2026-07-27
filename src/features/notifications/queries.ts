import "server-only";

import { getSystemSetting, getSystemSettings } from "@/features/system-settings/queries";
import { notificationCapabilities, notificationCapabilitySettingKey, type NotificationCapabilityId } from "./catalog";

export async function isNotificationCapabilityEnabled(id: NotificationCapabilityId) {
  return (await getSystemSetting(notificationCapabilitySettingKey(id))) !== "false";
}

export async function getNotificationCapabilityStates() {
  const settings = await getSystemSettings(notificationCapabilities.map((item) => notificationCapabilitySettingKey(item.id)));
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  return notificationCapabilities.map((capability) => ({ ...capability, enabled: values.get(notificationCapabilitySettingKey(capability.id)) !== "false" }));
}
